SÖZTYNYS NOVA — NEW INDEPENDENT NETLIFY PROJECT

IMPORTANT: Do not modify your old website or repository.

1. Create a NEW GitHub repository.
2. Upload the CONTENTS of this folder to repository ROOT, not a parent folder:
   index.html
   netlify.toml
   netlify/functions/analyze.js
3. In Netlify choose Add new project > Import existing project > GitHub.
4. Select the new repository.
5. Base directory: leave empty.
   Build command: leave empty.
   Publish directory: .
   Functions directory: netlify/functions (configured in netlify.toml).
6. Add Environment variable SERPAPI_KEY (secret value from SerpApi).
7. Deploy or redeploy. Do not paste API keys into HTML or GitHub.
8. Check https://YOUR-SITE.netlify.app/. Then search for a word.

SerpApi sometimes omits total_results. In that case the UI says 'Дерек жоқ'.
The platform does not fabricate a vitality score. Six context categories are
calculated only from the first organic results returned by Google/SerpApi.
