#!/usr/bin/env python3
"""
Upload product images to Medusa v2 Admin API.

For each PNG file in plans/product-images/, finds the matching product by handle
(filename without .png), uploads the image, and sets it as thumbnail + images.

Usage:
    python3 scripts/upload-product-images.py

Environment variables (optional):
    MEDUSA_BACKEND_URL - Medusa backend URL (default: http://localhost:9000)
    MEDUSA_ADMIN_EMAIL - Admin email (default: admin@medusa-test.com)
    MEDUSA_ADMIN_PASSWORD - Admin password (default: supersecret)
"""

import os
import sys
import json
import glob
import requests
from pathlib import Path

# Configuration
BACKEND_URL = os.environ.get("MEDUSA_BACKEND_URL", "http://localhost:9000")
ADMIN_EMAIL = os.environ.get("MEDUSA_ADMIN_EMAIL", "upload@local.test")
ADMIN_PASSWORD = os.environ.get("MEDUSA_ADMIN_PASSWORD", "upload123")

IMAGES_DIR = Path(__file__).resolve().parent.parent / "plans" / "product-images"


def authenticate() -> str:
    """Authenticate with Medusa Admin API and return JWT token."""
    print(f"[AUTH] Authenticating as {ADMIN_EMAIL} at {BACKEND_URL}...")
    
    resp = requests.post(
        f"{BACKEND_URL}/auth/user/emailpass",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        headers={"Content-Type": "application/json"},
    )
    
    if resp.status_code != 200:
        print(f"[AUTH] Failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    token = data.get("token")
    if not token:
        print(f"[AUTH] No token in response: {data}")
        sys.exit(1)
    
    print("[AUTH] Success.")
    return token


def get_all_products(token: str) -> list:
    """Fetch all products from Medusa Admin API with pagination."""
    products = []
    offset = 0
    limit = 100
    
    while True:
        resp = requests.get(
            f"{BACKEND_URL}/admin/products",
            params={"offset": offset, "limit": limit, "fields": "id,handle,title,thumbnail"},
            headers={"Authorization": f"Bearer {token}"},
        )
        
        if resp.status_code != 200:
            print(f"[PRODUCTS] Failed to fetch: {resp.status_code} {resp.text}")
            sys.exit(1)
        
        data = resp.json()
        batch = data.get("products", [])
        products.extend(batch)
        
        count = data.get("count", len(batch))
        offset += limit
        
        if offset >= count:
            break
    
    print(f"[PRODUCTS] Fetched {len(products)} products.")
    return products


def upload_image(token: str, filepath: Path) -> str:
    """Upload an image file to Medusa and return the URL."""
    with open(filepath, "rb") as f:
        files = {"files": (filepath.name, f, "image/png")}
        resp = requests.post(
            f"{BACKEND_URL}/admin/uploads",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
    
    if resp.status_code not in (200, 201):
        print(f"[UPLOAD] Failed for {filepath.name}: {resp.status_code} {resp.text}")
        return None
    
    data = resp.json()
    uploaded_files = data.get("files", [])
    
    if not uploaded_files:
        print(f"[UPLOAD] No files in response for {filepath.name}: {data}")
        return None
    
    url = uploaded_files[0].get("url")
    print(f"[UPLOAD] {filepath.name} -> {url}")
    return url


def update_product_images(token: str, product_id: str, image_url: str) -> bool:
    """Update product thumbnail and images."""
    resp = requests.post(
        f"{BACKEND_URL}/admin/products/{product_id}",
        json={
            "thumbnail": image_url,
            "images": [{"url": image_url}],
        },
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    
    if resp.status_code not in (200, 201):
        print(f"[UPDATE] Failed for product {product_id}: {resp.status_code} {resp.text}")
        return False
    
    return True


def main():
    # Check images directory
    if not IMAGES_DIR.exists():
        print(f"[ERROR] Images directory not found: {IMAGES_DIR}")
        sys.exit(1)
    
    # Get all PNG files
    image_files = sorted(IMAGES_DIR.glob("*.png"))
    if not image_files:
        print(f"[ERROR] No PNG files found in {IMAGES_DIR}")
        sys.exit(1)
    
    print(f"[INFO] Found {len(image_files)} image files in {IMAGES_DIR}")
    
    # Authenticate
    token = authenticate()
    
    # Get all products
    products = get_all_products(token)
    
    # Build handle -> product map
    handle_map = {p["handle"]: p for p in products if p.get("handle")}
    print(f"[INFO] Products with handles: {len(handle_map)}")
    
    # Process each image
    success_count = 0
    skip_count = 0
    fail_count = 0
    
    for img_path in image_files:
        handle = img_path.stem  # filename without extension
        
        if handle not in handle_map:
            print(f"[SKIP] No product with handle '{handle}'")
            skip_count += 1
            continue
        
        product = handle_map[handle]
        product_id = product["id"]
        print(f"\n[PROCESS] {handle} -> product {product_id} ({product.get('title', 'N/A')})")
        
        # Upload image
        image_url = upload_image(token, img_path)
        if not image_url:
            fail_count += 1
            continue
        
        # Update product
        if update_product_images(token, product_id, image_url):
            print(f"[OK] Updated product '{handle}' with thumbnail")
            success_count += 1
        else:
            fail_count += 1
    
    # Summary
    print(f"\n{'='*60}")
    print(f"[SUMMARY]")
    print(f"  Total images:  {len(image_files)}")
    print(f"  Success:       {success_count}")
    print(f"  Skipped:       {skip_count} (no matching product)")
    print(f"  Failed:        {fail_count}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
