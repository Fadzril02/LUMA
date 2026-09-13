import requests
import re

urls = [
    "https://luma-nikkj3h9b-fadzril-my.vercel.app",
    "https://luma-two-theta.vercel.app"
]

for base_url in urls:
    print("=" * 60)
    print(f"Checking {base_url}")
    print("=" * 60)
    try:
        r = requests.get(base_url)
        print(f"HTML Status: {r.status_code}")
        # Find script tags
        scripts = re.findall(r'src=["\']([^"\']+\.js)["\']', r.text)
        print(f"Script tags found: {scripts}")
        for s in scripts:
            js_url = base_url + s if s.startswith('/') else base_url + '/' + s
            r_js = requests.get(js_url)
            print(f"  Fetching: {js_url} (HTTP {r_js.status_code}, length {len(r_js.text)})")
            # Check for supabase url in the bundle
            found_urls = re.findall(r'https://[a-zA-Z0-9_\-]+\.supabase\.co', r_js.text)
            print(f"  Supabase URLs in bundle: {set(found_urls)}")
            # Check for JWT keys in bundle
            jwts = re.findall(r'eyJhbGciOiJIUzI[a-zA-Z0-9_\-\.]+', r_js.text)
            print(f"  JWT keys in bundle: {len(jwts)} found")
            for j in jwts:
                print(f"    Key prefix: {j[:25]}... (len {len(j)})")
    except Exception as e:
        print(f"Error checking {base_url}: {e}")
