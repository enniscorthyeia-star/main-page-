# Enniscorthy Indian Association (EIA)

Official web portal for the **Enniscorthy Indian Association (EIA)**, representing the Indian diaspora and community in Enniscorthy and County Wexford, Republic of Ireland.

> **"Together, We Celebrate. Together, We Connect. Together, We Grow."**

---

## Project Structure

```text
eia/
├── index.html            # Main website homepage (About, Pillars, Trustees, Committee, Events, Gallery, Contact)
├── guide.html            # Local Discovery Guide (12 curated County Wexford & Enniscorthy destinations)
├── membership.html       # Membership Hub (Registration, tier details, FAQ, direct application)
├── admin.html            # Association management & preview portal
├── docs/                 # Association documents and vector branding PDFs
│   ├── EIA Logo_01.pdf
│   └── Untitled-2 (1).pdf
├── images/               # All visual media
│   ├── logo.png          # EIA official circular emblem
│   ├── hero-bg.jpg       # Enniscorthy aerial panoramic banner
│   ├── hero-video.mp4    # Background video loop for hero section
│   ├── guide/            # 12 authentic photos for each local guide destination
│   ├── committee/        # Executive committee member portraits
│   └── committee_sq/     # Square-cropped committee & trustee portraits
├── archive/              # Organized legacy archives
│   ├── legacy-pages/     # Old templates, drafts, pitch variants, and deprecated scripts
│   ├── raw-uploads/      # Unprocessed event photo batches
│   ├── stock/            # Unused stock photography
│   └── components/       # Archived UI component drafts
├── .gitignore            # Git exclusion rules
└── README.md             # Project documentation
```

---

## Key Features

- **Mobile First & Responsive**: Optimized for viewports from 320px to 4K displays with touch-friendly drawer navigation.
- **Local Discovery Editorial**: Search and category filtering for 12 authentic historical and family attractions in County Wexford.
- **Committee & Governance**: Clear designations (Auditors, Secretary, Members, Executive Officers) with verified contact channels.
- **Zero External Dependencies**: Pure semantic HTML5, modern CSS3 (custom properties, flexbox, CSS grid), and vanilla JavaScript.
- **Accessibility & SEO**: Meta tags, OpenGraph sharing cards, descriptive alt attributes, and smooth focus states.

---

## Running Locally

Run a local development server using Python:

```bash
# Python 3
python3 -m http.server 8000
```

Open your browser at `http://localhost:8000/`.

---

## Deploying to GitHub Pages

1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: EIA official community portal release"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. Navigate to **Settings** > **Pages** in your GitHub repository.
3. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`, then click **Save**.
5. Your live site will be available at `https://<your-username>.github.io/<repo-name>/`.

---

## License & Copyright

&copy; 2026 Enniscorthy Indian Association (EIA). All rights reserved.
Enniscorthy, County Wexford, Republic of Ireland.
