from openai import OpenAI
from ..utils import encode_image, decode_response
import json, os
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv('FS_OPENAI_API_KEY'))

def financial_data(document_type):
  if document_type == "Balance Sheet":
      financial_fields = "total_current_assets;total_non_current_assets;total_assets;total_current_liabilities;total_non_current_liabilities;total_liabilities;total_equity;total_liabilities_and_equity"
  elif document_type == "Income Statement":
      financial_fields = "revenue;cost_of_goods;gross_profit;earnings_before_tax"
  elif document_type == "Cash Flow Statement":
      financial_fields = "net_cash_from_operating_activities;net_cash_from_investing_activities;net_cash_from_financing_activities"
  else:
      financial_fields = ""
  return  financial_fields

def clean_fs_data(fs_data):
    for doc_type, doc_data in fs_data.items():
        data_list = doc_data['data']

        for item in data_list:
            for field, values in item.items():
                values['last_year'] = values['last_year'].replace('.', '').replace(',', '')
                values['current_year'] = values['current_year'].replace('.', '').replace(',', '')

    return fs_data

def document_type_classification(image_path):
  instruction = f"""
  Identify the type of document and choose between the following options:
      - Balance Sheet, or
      - Income Statement, or
      - Cash Flow Statement.

  Output Format:
  Present the extracted data in the following JSON structure.

  {{
    "document_type": "value",
  }}
  """

  content = [{"type":"text", "text": instruction}]
  content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encode_image(image_path)}"}})

  response = client.chat.completions.create(
      model="gpt-4o-mini",
      response_format={ "type": "json_object" },
      messages=[
          {"role": "system", "content": "You are a helpful assistant with expertise in financial analysis and document processing. Your task is to classify document type of a Financial Statement document in English."},
          {"role": "user", "content": content}
      ]
  )
  return response

def extract_financial_data(image_paths,financial_fields):
  instruction = f"""
  Fields to Extract:

  1. Document Details:
    - Company Name: Extract the name of the company from the document.
    - Document Type: Identify the type of document and choose between the following options:
      - Balance Sheet, or
      - Income Statement, or
      - Cash Flow Statement.
    - Last Year Period: Extract the year of the last year period (e.g., 2023).
    - Current Year Period: Extract the year of the current year period (e.g., \2024).

  2. Financial Data:
    - {", ".join(financial_fields)}

  Output Format:
  Present the extracted data in the following JSON structure. The nominal value should be an integer number:

  {{
    "company_name": "value",
    "document_type": "Balance Sheet",
    "last_year_period": "value",
    "current_year_period": "value",
    "data": [
      {{
        "financial_field_1": {{
          "last_year": "value",
          "current_year": "value"
        }}
      }},
      {{
        "financial_field_2": {{
          "last_year": "value",
          "current_year": "value"
        }}
      }},
      ...
    ]
  }}

  Error Handling:
  - If any field is not found, set the value to null.

  Contextual Understanding:
  - Use your financial analysis expertise to accurately interpret and extract the relevant data from the document.
  """
  content = [{"type":"text", "text": instruction}]
  for i in range(len(image_paths)):
      content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encode_image(image_paths[i])}"}})

  response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={ "type": "json_object" },
        messages=[
            {"role": "system", "content": "You are a helpful assistant with expertise in financial analysis and document processing. Your task is to extract key financial data a Financial Statement document in English."},
            {"role": "user", "content": content}
        ]
    )

  return response

def classification_inference(image_paths):
  document_types = {
        "Balance Sheet": [],
        "Income Statement": [],
        "Cash Flow Statement": []
    }
  total_prompt_tokens = 0
  total_completion_tokens = 0
  for image_path in image_paths:
    json_response = document_type_classification(image_path)
    prompt_tokens, completion_tokens, json_response = decode_response(json_response)
    total_prompt_tokens += prompt_tokens
    total_completion_tokens += completion_tokens
    document_type = json_response["document_type"]
    if document_type in document_types:
            document_types[document_type].append(image_path)
    else:
        print(f"Unknown document type '{document_type}' for image '{image_path}'.")
  return document_types, total_prompt_tokens, total_completion_tokens

def fs_inference(document_types, prompt_tokens, completion_tokens):
  total_prompt_tokens = prompt_tokens
  total_completion_tokens = completion_tokens
  fs_data = {}
  for doc_type, file_paths in document_types.items():
    json_response = extract_financial_data(file_paths,financial_data(doc_type))
    prompt_tokens, completion_tokens, json_response = decode_response(json_response)
    total_prompt_tokens += prompt_tokens
    total_completion_tokens += completion_tokens
    fs_data[doc_type] = json_response
  # fs_data = clean_fs_data(fs_data)
  return fs_data, total_prompt_tokens, total_completion_tokens