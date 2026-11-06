# DagoEng Design System & Brand Identity

Brand: **DagoEng Creative Hub**  
Product: **DagoEng F&B Management**  
Tagline: *Smarter F&B. Better Operations.*

---

## 1. Official Brand Color Accents

The official DagoEng brand colors are applied strictly as accents across the interface:

```css
/* Official DagoEng Brand Palette */
--brand-orange: #FF6B00; /* Primary Brand & Main Actions */
--brand-cyan:   #00B2FE; /* Information & Technology */
--brand-green:  #00C853; /* Success, Profit Margin & Ready Status */
--brand-yellow: #FFB300; /* Warning, Alerts & Star Metrics */
```

### Neutral SaaS Base:
- **Background**: `#F8FAFC` (Slate 50 off-white)
- **Paper / Cards**: `#FFFFFF`
- **Text / Foreground**: `#0F172A` (Slate 900 charcoal)
- **Muted Text**: `#64748B` (Slate 500)
- **Borders**: `#E2E8F0` (Slate 200 subtle border)

---

## 2. Official Vector Logo Asset

Located at:
- Vector SVG: `/public/logo-dagoeng.svg`
- Raster PNG: `/public/logo-dagoeng.png`

The logo consists of four geometric circular characters arranged in a 2x2 grid:
1. **d** (Top-Left): Brand Orange `#FF6B00`
2. **a** (Top-Right): Brand Cyan `#00B2FE`
3. **g** (Bottom-Left): Brand Green `#00C853`
4. **o** (Bottom-Right): Brand Yellow `#FFB300`

---

## 3. Core Component Library

- **Buttons** (`src/components/ui/button.tsx`): Default (Brand Orange), Outline, Secondary, Cyan, Green, Danger.
- **Badges** (`src/components/ui/badge.tsx`): Default, Info (Cyan), Success (Green), Warning (Yellow), Danger, Outline.
- **Cards** (`src/components/ui/card.tsx`): Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
- **KPI Cards** (`src/features/dashboard/KPICard.tsx`): Metric display with trend badge and color accent borders.
- **AI Insight Card** (`src/features/dashboard/AIInsightCard.tsx`): Structured format with `[INSIGHT]`, `[EVIDENCE]`, `[RECOMMENDATION]`, `[ACTION]`.
