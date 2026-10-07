from openai import OpenAI
from ..utils import encode_image
from models import FaasBsSubcategories, FaasBsSubcategoriesKeywords
import json, os
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv('BS_OPENAI_API_KEY'))

def extract_bs_informations(image_path):
    model_name = os.getenv('OPENAI_VISION_MODEL', 'gpt-4o-mini')
    instruction = """
        You are an expert AI assistant designed to perform Optical Character Recognition (OCR) and high-accuracy data extraction from Bank Statements (Rekening Koran).

        Examine the image carefully and extract all header metadata and line-item transactions.
        If a transaction spans multiple lines without a new date, group it into the same transaction.

        Output JSON structure:
        {
            "bankName": "Name of the bank e.g. BCA, Mandiri, BNI, BRI, CIMB Niaga, etc. (Leave empty string if not found)",
            "accountNumber": "Account number / Nomor Rekening (Leave empty string if not found)",
            "accountType": "Account type e.g. Rekening Tahapan, Tabungan, Giro, etc. (Leave empty string if not found)",
            "accountHolderName": "Account holder name / Nama Pemilik Rekening (Leave empty string if not found)",
            "currency": "Currency code e.g. IDR, USD, EUR (Leave empty string if not found)",
            "transactions": [
                {
                    "date": "Transaction date in yyyy-mm-dd format e.g. 2024-01-15",
                    "description": "Full transaction description text",
                    "type": "Withdrawal or Deposit or Debit or Credit",
                    "amount": "Numeric amount string e.g. 500000.00"
                }
            ]
        }
        """
    content = [{"type": "text", "text": instruction}]
    content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encode_image(image_path)}"}})
    
    response = client.chat.completions.create(
        model=model_name,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "You are a precise document extraction AI that outputs valid JSON."},
            {"role": "user", "content": content}
        ]
    )

    result = json.loads(response.choices[0].message.content)
    prompt_usage = response.usage.prompt_tokens if response.usage else 0
    completion_usage = response.usage.completion_tokens if response.usage else 0
    return result, prompt_usage, completion_usage

def build_transaction_categories(bs_id):
    transaction_categories = {}
    
    subcategories = FaasBsSubcategories.query.filter_by(bsId=bs_id).all()
    for subcategory in subcategories:
        category_name = subcategory.category
        subcategory_name = subcategory.name
        
        if category_name not in transaction_categories:
            transaction_categories[category_name] = {}
        
        keywords = FaasBsSubcategoriesKeywords.query.filter_by(subcategoryId=subcategory.id).all()
        keyword_list = [keyword.keyword for keyword in keywords]
        
        transaction_categories[category_name][subcategory_name] = keyword_list
    
    return transaction_categories



def categorize_transaction(description, transaction_categories):
    description_lower = description.lower()
    for category, subcategories in transaction_categories.items():
        for subcategory, keywords in subcategories.items():
            for keyword in keywords:
                if keyword.lower() in description_lower:
                    return category, subcategory
    return "Unknown", "Unknown"

def convert_transaction_type(transaction_type):
    if transaction_type == "Withdrawal":
        transaction_type = "Debit"
    elif transaction_type == "Credit":
        transaction_type = "Deposit"
    return transaction_type