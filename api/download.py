from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import tempfile
import subprocess
import uuid
from urllib.parse import parse_qs, urlparse

# Add current directory to path untuk import modules
sys.path.append(os.path.dirname(__file__))

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def do_POST(self):
        if self.path == '/api/download':
            self.handle_download()
        else:
            self.send_error(404)
    
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')
    
    def handle_download(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            scribd_url = data.get('scribdUrl')
            task_id = data.get('taskId', str(uuid.uuid4()))
            
            if not scribd_url:
                self.send_error(400, 'Missing scribdUrl')
                return
            
            # Process download
            result = self.process_scribd_download(scribd_url, task_id)
            
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_error(500, f'Server error: {str(e)}')
    
    def process_scribd_download(self, scribd_url, task_id):
        # Create temporary directory untuk download
        with tempfile.TemporaryDirectory() as temp_dir:
            script_path = os.path.join(temp_dir, 'download_script.py')
            
            # Write download script
            with open(script_path, 'w') as f:
                f.write(f'''
from playwright.sync_api import sync_playwright
from PyPDF2 import PdfMerger
import os
import re
import time
import shutil

ZOOM = 0.625
book_url = "{scribd_url}"
temp_dir = "{temp_dir}"

def main():
    with sync_playwright() as playwright:
        # Setup browser
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={{'width': 1200, 'height': 1600}})
        
        page = context.new_page()
        
        try:
            # Try to access the document
            page.goto(book_url.replace('book', 'read'), wait_until='domcontentloaded', timeout=30000)
            
            if 'Browser limit exceeded' in page.content():
                return {{"success": False, "error": "Browser limit exceeded"}}
            
            if 'Login required' in page.content():
                return {{"success": False, "error": "Login required - please add session.json"}}
            
            # Continue dengan kode download Anda...
            # ... (sisa kode download Anda di sini)
            
            # Untuk demo, return success dengan info
            return {{
                "success": True,
                "message": "Download completed",
                "fileSize": 1024,  # dummy size
                "pages": 10,       # dummy pages
                "filename": "document.pdf"
            }}
            
        except Exception as e:
            return {{"success": False, "error": str(e)}}
        finally:
            browser.close()

result = main()
print("RESULT:" + json.dumps(result))
''')
            
            # Run the script
            try:
                result = subprocess.run([
                    'python', script_path
                ], capture_output=True, text=True, timeout=300, cwd=temp_dir)
                
                if result.returncode == 0:
                    # Extract result dari output
                    for line in result.stdout.split('\\n'):
                        if line.startswith('RESULT:'):
                            return json.loads(line[7:])
                
                return {
                    "success": False,
                    "error": result.stderr or "Unknown error occurred"
                }
                
            except subprocess.TimeoutExpired:
                return {
                    "success": False,
                    "error": "Download timeout - document too large"
                }
            except Exception as e:
                return {
                    "success": False, 
                    "error": f"Execution error: {str(e)}"
                }

def handler(event, context):
    return Handler()
