from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from models import Credentials, RegisterRequest, ProductIn
from database import supabase


ADMIN_USERNAME = "admin@123"
ADMIN_PASSWORD = "admin@123"
ADMIN_SESSION_TOKEN = "admin-session-token"

app = FastAPI(title="Serein API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_origin_regex=r"https://[a-z0-9-]+\.vercel\.app|http://(127\.0\.0\.1|localhost):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def admin_user() -> Dict[str, Any]:
    return {"id": "admin", "name": "Admin", "email": ADMIN_USERNAME, "is_admin": True}


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": user["id"], "name": user["name"], "email": user.get("email", ""), "phone": user.get("phone", ""), "is_admin": user.get("is_admin", False)}


def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = authorization[len("Bearer "):].strip()

    if token == ADMIN_SESSION_TOKEN:
        return admin_user()
    
    if supabase is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase not configured")

    res = supabase.table("sessions").select("*").eq("token", token).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    
    user_id = res.data[0]["user_id"]
    if user_id == "admin":
        return admin_user()
        
    res_user = supabase.table("users").select("*").eq("id", user_id).execute()
    if not res_user.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    
    return res_user.data[0]


def require_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> Dict[str, str]:
    return {"status": "ok", "service": "Serein API"}


@app.get("/products")
def products(family: Optional[str] = None) -> List[Dict[str, Any]]:
    if supabase is None:
        return []
    query = supabase.table("products").select("*")
    if family:
        query = query.eq("scent_family", family)
    res = query.execute()
    return res.data


@app.post("/products", dependencies=[Depends(require_admin)])
def create_product(product: ProductIn) -> Dict[str, Any]:
    item = product.model_dump()
    res = supabase.table("products").insert(item).execute()
    return res.data[0]


@app.put("/products/{product_id}", dependencies=[Depends(require_admin)])
def update_product(product_id: int, product: ProductIn) -> Dict[str, Any]:
    item = product.model_dump()
    res = supabase.table("products").update(item).eq("id", product_id).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return res.data[0]


@app.post("/auth/login")
def login(credentials: Credentials) -> Dict[str, Any]:
    if not credentials.email and not credentials.phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email or phone number is required.")

    if credentials.email == ADMIN_USERNAME and credentials.password == ADMIN_PASSWORD:
        return {"token": ADMIN_SESSION_TOKEN, "user": admin_user()}

    if supabase is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase not configured")

    query = supabase.table("users").select("*")
    if credentials.email:
        query = query.eq("email", credentials.email)
    else:
        query = query.eq("phone", credentials.phone)
    query = query.eq("password", credentials.password)
    res = query.execute()

    if not res.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")
    
    user = res.data[0]
    token = uuid4().hex
    supabase.table("sessions").insert({"token": token, "user_id": str(user["id"])}).execute()
    return {"token": token, "user": public_user(user)}


@app.post("/auth/register")
def register(payload: RegisterRequest) -> Dict[str, Any]:
    if supabase is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase not configured")

    if not payload.email and not payload.phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email or phone number is required.")

    # Check for existing user by email or phone
    if payload.email:
        res = supabase.table("users").select("id").eq("email", payload.email).execute()
        if res.data:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")
    if payload.phone:
        res = supabase.table("users").select("id").eq("phone", payload.phone).execute()
        if res.data:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone number already registered.")
    
    user_data = {
        "name": payload.name,
        "password": payload.password,
        "is_admin": False
    }
    if payload.email:
        user_data["email"] = payload.email
    if payload.phone:
        user_data["phone"] = payload.phone

    insert_res = supabase.table("users").insert(user_data).execute()
    user = insert_res.data[0]
    
    token = uuid4().hex
    supabase.table("sessions").insert({"token": token, "user_id": str(user["id"])}).execute()
    return {"token": token, "user": public_user(user)}


@app.get("/auth/me")
def me(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return public_user(user)


@app.get("/cart")
def get_cart(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, int]:
    res = supabase.table("cart_items").select("*").eq("user_id", str(user["id"])).execute()
    return {str(item["product_id"]): item["quantity"] for item in res.data}


@app.post("/cart/items/{product_id}")
def add_cart_item(product_id: int, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, int]:
    prod_res = supabase.table("products").select("id").eq("id", product_id).execute()
    if not prod_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        
    user_id_str = str(user["id"])
    
    cart_res = supabase.table("cart_items").select("*").eq("user_id", user_id_str).eq("product_id", product_id).execute()
    if cart_res.data:
        new_quantity = cart_res.data[0]["quantity"] + 1
        supabase.table("cart_items").update({"quantity": new_quantity}).eq("user_id", user_id_str).eq("product_id", product_id).execute()
    else:
        supabase.table("cart_items").insert({"user_id": user_id_str, "product_id": product_id, "quantity": 1}).execute()
        
    return get_cart(user)


@app.delete("/cart/items/{product_id}")
def remove_cart_item(product_id: int, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, int]:
    user_id_str = str(user["id"])
    supabase.table("cart_items").delete().eq("user_id", user_id_str).eq("product_id", product_id).execute()
    return get_cart(user)


@app.post("/checkout")
def checkout(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    user_id_str = str(user["id"])
    supabase.table("cart_items").delete().eq("user_id", user_id_str).execute()
    return {"status": "confirmed"}
