from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4
import json

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


DATA_FILE = Path(__file__).with_name("data.json")
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin"

app = FastAPI(title="Serein API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Credentials(BaseModel):
    email: str
    password: str


class RegisterRequest(Credentials):
    name: str


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


def seed_data() -> Dict[str, Any]:
    return {
        "products": [
            {
                "id": 1,
                "name": "Midnight Lavender",
                "description": "A calming blend of French lavender and deep woods, perfect for unwinding after a long day.",
                "price": 28,
                "scent_family": "Floral",
                "burn_time": "45-50 hours",
                "stock_quantity": 15,
                "scent_profile": {"top": "Bergamot", "middle": "French Lavender", "base": "Cedarwood"},
                "image_url": "https://images.unsplash.com/photo-1605814046907-7bc944d18721?auto=format&fit=crop&q=80&w=800",
            },
            {
                "id": 2,
                "name": "Sandalwood & Fig",
                "description": "Warm, earthy sandalwood paired with the subtle sweetness of ripe fig. An elegant and grounding aroma.",
                "price": 32,
                "scent_family": "Woody",
                "burn_time": "50-60 hours",
                "stock_quantity": 8,
                "scent_profile": {"top": "Fig Leaf", "middle": "Violet", "base": "Sandalwood"},
                "image_url": "https://images.unsplash.com/photo-1602874801007-bd458cb6b9ea?auto=format&fit=crop&q=80&w=800",
            },
            {
                "id": 3,
                "name": "Sicilian Lemon",
                "description": "Bright and refreshing citrus notes that energize any space. Like a sunny day in a jar.",
                "price": 24,
                "scent_family": "Citrus",
                "burn_time": "40-45 hours",
                "stock_quantity": 20,
                "scent_profile": {"top": "Lemon Zest", "middle": "Basil", "base": "White Musk"},
                "image_url": "https://images.unsplash.com/photo-1608181708892-3c224b52e391?auto=format&fit=crop&q=80&w=800",
            },
            {
                "id": 4,
                "name": "Forest Rain",
                "description": "The crisp scent of damp earth and pine needles after a heavy rainfall.",
                "price": 26,
                "scent_family": "Earthy",
                "burn_time": "45-55 hours",
                "stock_quantity": 12,
                "scent_profile": {"top": "Petrichor", "middle": "Pine", "base": "Oakmoss"},
                "image_url": "https://images.unsplash.com/photo-1591122822187-5784c6c06a88?auto=format&fit=crop&q=80&w=800",
            },
        ],
        "users": [],
        "sessions": {},
        "carts": {},
    }


def read_data() -> Dict[str, Any]:
    if not DATA_FILE.exists():
        write_data(seed_data())
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def write_data(data: Dict[str, Any]) -> None:
    DATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": user["id"], "name": user["name"], "email": user.get("email", ""), "is_admin": user.get("is_admin", False)}


def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = authorization[len("Bearer "):].strip()
    data = read_data()
    user_id = data["sessions"].get(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    if user_id == "admin":
        return {"id": "admin", "name": "Admin", "email": ADMIN_USERNAME, "is_admin": True}
    user = next((item for item in data["users"] if item["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return user


def require_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/products")
def products(family: Optional[str] = None) -> List[Dict[str, Any]]:
    items = read_data()["products"]
    if family:
        return [item for item in items if item["scent_family"] == family]
    return items


@app.post("/products", dependencies=[Depends(require_admin)])
def create_product(product: ProductIn) -> Dict[str, Any]:
    data = read_data()
    next_id = max([item["id"] for item in data["products"]] or [0]) + 1
    item = {"id": next_id, **product.model_dump()}
    data["products"].append(item)
    write_data(data)
    return item


@app.post("/auth/login")
def login(credentials: Credentials) -> Dict[str, Any]:
    data = read_data()
    if credentials.email == ADMIN_USERNAME and credentials.password == ADMIN_PASSWORD:
        token = uuid4().hex
        data["sessions"][token] = "admin"
        data["carts"].setdefault("admin", {})
        write_data(data)
        return {"token": token, "user": {"id": "admin", "name": "Admin", "email": ADMIN_USERNAME, "is_admin": True}}

    user = next((item for item in data["users"] if item["email"] == credentials.email and item["password"] == credentials.password), None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email/username or password.")

    token = uuid4().hex
    data["sessions"][token] = user["id"]
    data["carts"].setdefault(str(user["id"]), {})
    write_data(data)
    return {"token": token, "user": public_user(user)}


@app.post("/auth/register")
def register(payload: RegisterRequest) -> Dict[str, Any]:
    data = read_data()
    if any(item["email"] == payload.email for item in data["users"]):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")
    user = {"id": str(uuid4()), "name": payload.name, "email": payload.email, "password": payload.password, "is_admin": False}
    token = uuid4().hex
    data["users"].append(user)
    data["sessions"][token] = user["id"]
    data["carts"][user["id"]] = {}
    write_data(data)
    return {"token": token, "user": public_user(user)}


@app.get("/auth/me")
def me(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return public_user(user)


@app.get("/cart")
def get_cart(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, int]:
    return read_data()["carts"].setdefault(str(user["id"]), {})


@app.post("/cart/items/{product_id}")
def add_cart_item(product_id: int, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, int]:
    data = read_data()
    if not any(item["id"] == product_id for item in data["products"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    cart = data["carts"].setdefault(str(user["id"]), {})
    key = str(product_id)
    cart[key] = cart.get(key, 0) + 1
    write_data(data)
    return cart


@app.delete("/cart/items/{product_id}")
def remove_cart_item(product_id: int, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, int]:
    data = read_data()
    cart = data["carts"].setdefault(str(user["id"]), {})
    cart.pop(str(product_id), None)
    write_data(data)
    return cart


@app.post("/checkout")
def checkout(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    data = read_data()
    data["carts"][str(user["id"])] = {}
    write_data(data)
    return {"status": "confirmed"}
