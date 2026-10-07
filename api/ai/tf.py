from openai import OpenAI
from ..utils import encode_image
import json, os
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv('FS_OPENAI_API_KEY'))

def documents_classification(image_path):
    instruction = """
        You are an expert in financial documents, and your task is to identify various types of financial documents from images. The types of documents you need to identify are:

        1. MT700 SWIFT Message
        2. Bill of Exchange
        3. Bill of Lading
        4. Letter of Credit
        5. Invoice
        6. Delivery Receipt
        7. Certificate of Origin
        8. Purchase Order

        Each document has specific features and elements that can help in their identification. Here are the key characteristics to look for:

        - **MT700 SWIFT Message**: A standardized message used in the SWIFT system for issuing Documentary Letters of Credit. It has a structured format with fields prefixed by a colon (e.g., :27:, :40A:, :20:, :31C:, :59:, :32B:, :41D:, :42A:, :44E:, :44F:, :45A:, :46A:, :47A:, :71B:, :48:, :49:, :78:, :57D:, :722:). These tags are consistent and specific to SWIFT messages.
        - **Bill of Exchange**: Document with terms like "Draft", "Pay to the order of", contains amounts and payment details.
        - **Bill of Lading**: Includes shipping details, carrier information, terms like "Shipper", "Consignee", "Notify Party".
        - **Letter of Credit**: Contains terms like "Beneficiary", "Applicant", "Irrevocable", detailed financial terms and conditions, but without the strict tag structure of an MT700.
        - **Invoice**: Includes "Invoice" header, bill to and ship to addresses, itemized list of goods/services, total amount due.
        - **Delivery Receipt**: Document confirming the delivery of goods, includes details of items delivered, recipient signature.
        - **Certificate of Origin**: Certifies the origin of the goods, includes statements of origin, issuing authority’s signature and seal.
        - **Purchase Order**: Contains "Purchase Order" header, order details, buyer and seller information, terms of purchase.

        Identify the type of document and follow the guidelines below to structure the output in JSON format.
        {
            "documentType": ""
        }
        """
    content = [{"type":"text", "text": instruction}]
    content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encode_image(image_path)}"}})
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={ "type": "json_object" },
        messages=[
            {"role": "system", "content": "You are a helpful assistant designed to output JSON based on the content of image."},
            {"role": "user", "content": content}
        ]
    )


    result = json.loads(response.choices[0].message.content)
    prompt_usage = response.usage.prompt_tokens
    completion_usage = response.usage.completion_tokens
    return result,prompt_usage,completion_usage

def extract_tf_informations(image_paths):
    instruction = """
        You are an expert in financial documents, and your task is to extract specific information from an image of a trade finance document. The key fields you need to identify and extract are:
        
        - **fieldLCNo**: The letter of credit number. It often appears as a unique identifier for the document.
        - **fieldBeneficiary**: The name of the beneficiary. It represents the entity that will receive the funds.
        - **fieldDrawee**: The name of the drawee. It is the bank or entity on which the draft is drawn.
        - **fieldCustomer**: The name of the customer or applicant. It represents the entity requesting the letter of credit.
        - **fieldCurrency**: The currency code. It indicates the currency in which the credit amount is denominated.
        - **fieldAmount**: The amount. It specifies the total amount of the credit.
        - **fieldTenor**: The tenor. It specifies the duration or payment terms.
        
        If you are not at least 50% sure about the extracted value for any field, leave it empty. Here is an image of the document. Extract the information and structure the output in JSON format as shown below:

        {
            "fieldLCNo": "",
            "fieldBeneficiary": "",
            "fieldDrawee": "",
            "fieldCustomer": "",
            "fieldCurrency": "",
            "fieldAmount": "",
            "fieldTenor": ""
        }
        
        Please fill in the extracted information in the corresponding fields.
        """
    content = [{"type":"text", "text": instruction}]
    for image_path in image_paths:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encode_image(image_path)}"}})
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={ "type": "json_object" },
        messages=[
            {"role": "system", "content": "You are a helpful assistant designed to output JSON based on the content of image."},
            {"role": "user", "content": content}
        ]
    )


    result = json.loads(response.choices[0].message.content)
    prompt_usage = response.usage.prompt_tokens
    completion_usage = response.usage.completion_tokens
    return result,prompt_usage,completion_usage