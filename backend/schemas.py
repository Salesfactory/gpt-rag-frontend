from pydantic import BaseModel
from typing import Union

class BrandCreateSchema(BaseModel):
    brand_name: str
    organization_id: str
    brand_description: Union[str, None] = ""

class BrandUpdateSchema(BaseModel):
    brand_id: str
    brand_name: str
    brand_description: Union[str, None] = ""
    organization_id: str

class ProductCreateSchema(BaseModel):
    product_name: str
    brand_id: str
    product_description: Union[str, None] = ""
    organization_id: str
    category: str

class ProductUpdateSchema(BaseModel):
    product_id: str
    product_name: str
    product_description: Union[str, None] = ""
    category: str
    brand_id: str
    organization_id: str

class CompetitorCreateSchema(BaseModel):
    competitor_name: str
    competitor_description: Union[str, None] = ""
    industry: str
    organization_id: str

class CompetitorUpdateSchema(BaseModel):
    competitor_id: str
    competitor_name: str
    competitor_description: Union[str, None] = ""
    industry: str
    organization_id: str