import logging
import os
import requests
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger("loom")

class DatabaseProvisioner:
    """Manages the autonomous provisioning of PocketBase collections."""
    
    def __init__(self, pb_url: str = "http://127.0.0.1:8090"):
        self.pb_url = pb_url
        self.admin_email = "admin@loom.local"
        self.admin_password = os.environ.get("PB_ADMIN_PASSWORD", "loom_secure_password")
        self.token = None

    @retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=10)) 
    def ensure_admin(self):
        """Authenticates as a superuser. Relies on main.py db_doctor() having created the account."""
        logger.info("Connecting to PocketBase Database Soul...")

        # Modern PocketBase v0.23+ Superuser Auth Endpoint
        auth_url_new = f"{self.pb_url}/api/collections/_superusers/auth-with-password"
        # Legacy PocketBase v0.22 and below Admin Auth Endpoint
        auth_url_old = f"{self.pb_url}/api/admins/auth-with-password"
        
        payload = {"identity": self.admin_email, "password": self.admin_password}

        for url in [auth_url_new, auth_url_old]:
            try:
                resp = requests.post(url, json=payload, timeout=5)
                if resp.status_code == 200:
                    self.token = resp.json().get("token")
                    logger.info(f"Successfully authenticated as PocketBase Superuser via {url.split('/')[-2]}.")
                    return True
                else:
                    logger.debug(f"Auth failed for {url} ({resp.status_code}): {resp.text}")
            except requests.exceptions.ConnectionError:
                logger.warning(f"PocketBase server is unreachable at {url}. Is the Docker container running?")
                raise Exception("PocketBase unreachable")
        
        logger.error("Failed to authenticate as Superuser/Admin with both modern and legacy endpoints.")
        return False

    def provision_schema(self, schema_json: list):
        """
        Takes a list of PocketBase collection definition dicts and pushes them to the API.
        This allows the LLM to define tables and we blindly create them.
        """
        if not self.token:
            if not self.ensure_admin():
                return False

        headers = {
            "Authorization": self.token,
            "Content-Type": "application/json"
        }
        
        collections_url = f"{self.pb_url}/api/collections"

        # 1. Get existing collections to avoid duplicates/errors
        existing_resp = requests.get(collections_url, headers=headers)
        existing_collections = {}
        if existing_resp.status_code == 200:
            for c in existing_resp.json().get('items', []):
                existing_collections[c['name']] = c

        success_count = 0

        for collection in schema_json:  
            # Translate legacy PocketBase v0.22 'schema' syntax to modern v0.23+ 'fields' syntax
            if "schema" in collection and "fields" not in collection:
                collection["fields"] = collection.pop("schema")

            name = collection.get("name")
            if not name: continue       

            # We skip 'users' as it's a default system collection that PB handles
            if name == "users" and "users" in existing_collections:
                logger.info("Skipping 'users' collection (system default).")    
                continue

            # Ensure open API rules so the React app can read/write without complex auth initially
            if "listRule" not in collection: collection["listRule"] = ""        
            if "viewRule" not in collection: collection["viewRule"] = ""        
            if "createRule" not in collection: collection["createRule"] = ""    
            if "updateRule" not in collection: collection["updateRule"] = ""    
            if "deleteRule" not in collection: collection["deleteRule"] = ""    

            if name in existing_collections:
                existing_id = existing_collections[name].get('id')
                logger.info(f"Collection '{name}' already exists. Patching to ensure schema is up to date.")
                
                patch_url = f"{collections_url}/{existing_id}"
                resp = requests.patch(patch_url, json=collection, headers=headers)
                
                if resp.status_code in [200, 204]:
                    logger.info(f"Successfully patched collection '{name}'.")
                    success_count += 1
                else:
                    logger.error(f"Failed to patch collection '{name}': {resp.text}")
                continue

            logger.info(f"Provisioning new collection: '{name}'...")

            resp = requests.post(collections_url, json=collection, headers=headers)
            if resp.status_code in [200, 201]:
                logger.info(f"Successfully created collection '{name}'.")       
                success_count += 1      
            else:
                logger.error(f"Failed to create collection '{name}': {resp.text}")

        return success_count == len(schema_json)
