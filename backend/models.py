from typing import Optional
from pydantic import BaseModel, Field

class Credentials(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str


class ScentProfile(BaseModel):
    top: str = "N/A"
    middle: str = "N/A"
    base: str = "N/A"


class ProductIn(BaseModel):
    name: str
    description: str
    price: float
    scent_family: str
    burn_time: str
    stock_quantity: int = Field(ge=0)
    image_url: Optional[str] = ""
    scent_profile: ScentProfile
