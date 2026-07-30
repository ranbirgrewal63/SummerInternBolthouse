# Bolthouse Foreign Material Detection Dashboard

A comprehensive React TypeScript dashboard for monitoring and analyzing foreign material detection on carrot processing conveyor belts.

![Dashboard Preview](https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=600&fit=crop)

## 🌟 Features

- **Real-time Monitoring**: Live camera feed and detection alerts
- **Historical Data Analysis**: View data from the past year
- **Interactive Charts**: Dual-view line and bar graphs with Recharts
- **Material Type Distribution**: Pie chart showing all detected materials
- **Detailed Logs**: Complete detection history with timestamps
- **Export Capabilities**: Export data in CSV, JSON, or PDF formats
- **Responsive Design**: Works on desktop and tablet devices
- **Date Range Filtering**: Flexible time range selection
- **Mock Data Generation**: Realistic data simulation for development

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- VSCode (recommended)

### Installation

1. **Create a new Vite project:**
   ```bash
   npm create vite@latest bolthouse-dashboard -- --template react-ts
   cd bolthouse-dashboard
   ```

2. **Replace the default files with this project:**
   - Copy all files from this repository
   - Replace the default `package.json`, `App.tsx`, etc.

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:5173`

## 📁 Project Structure

```
src/
├── App.tsx                          # Main application component
├── main.tsx                         # Application entry point
├── components/
│   ├── DashboardHeader.tsx         # Header with date and status
│   ├── DateRangeFilter.tsx         # Time range and date selection
│   ├── DetailedMaterialLog.tsx     # Comprehensive detection logs
│   ├── DetectionChart.tsx          # Dual-view charts (line + bar)
│   ├── DetectionTable.tsx          # Recent detections table
│   ├── LiveMonitoring.tsx          # Live system monitoring
│   ├── MaterialTypePieChart.tsx    # Material distribution chart
│   ├── MetricsCards.tsx            # Key metrics display
│   ├── figma/
│   │   └── ImageWithFallback.tsx   # Image component with fallback
│   └── ui/                         # ShadCN UI components
│       ├── accordion.tsx
│       ├── alert-dialog.tsx
│       ├── button.tsx
│       ├── calendar.tsx
│       ├── card.tsx
│       ├── chart.tsx
│       └── ... (40+ components)
├── styles/
│   └── globals.css                 # Tailwind v4 global styles
└── vite-env.d.ts                   # Vite type declarations
```

## 🛠️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS v4** - Styling
- **Recharts** - Chart library
- **Lucide React** - Icon library
- **ShadCN UI** - Component library
- **Radix UI** - Accessible primitives
- **date-fns** - Date utilities

## 📊 Data Features

### Time Ranges
- Today 
- Last 7 Days
- Last 30 Days  
- Last 3 Months
- Last 6 Months
- Last Year (full calendar year)
- This Month
- This Year

### Specific Date View
- Select any date from the past year
- View hourly breakdown for that day
- See all materials detected on that date

### Foreign Material Types (22 types)
Stone Fragment, Metal Piece, Plastic Fragment, Glass Fragment, Dirt Clump, Wood Chip, Rubber Piece, Paper Scrap, Cloth Fiber, Ceramic Piece, Wire Fragment, Paint Chip, Insect, Hair/Fur, Adhesive Residue, Concrete Debris, Foam Piece, Tile Fragment, Bone Fragment, Seed Pod, Leaf Debris, Root Fragment

## 📦 Key Dependencies

```json
{
  "recharts": "^2.12.7",
  "lucide-react": "^0.446.0",
  "date-fns": "^3.6.0",
  "@radix-ui/react-*": "Various versions",
  "tailwindcss": "^4.0.0"
}
```

## 🎨 Customization

### Modify Mock Data
Edit the data generation functions in `App.tsx`:
- `generateMasterDataStore()` - Main data generator
- `foreignMaterialTypes` - Material types array
- `materialColors` - Chart color palette

### Change Date Range
Update the calendar date range in `DateRangeFilter.tsx`:
```tsx
disabled={(date) => date > new Date() || date < new Date("2024-01-01")}
```

### Adjust Chart Appearance
Modify chart colors in `globals.css`:
```css
--chart-1: oklch(...);
--chart-2: oklch(...);
```

## 🚢 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Vercel
```bash
npm install -g vercel
vercel
```

### Deploy to Netlify
1. Build the project: `npm run build`
2. Drag the `dist/` folder to [Netlify](https://app.netlify.com/drop)

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔧 Configuration Files

- `vite.config.ts` - Vite configuration
- `tsconfig.json` - TypeScript configuration  
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration

## 📖 Documentation

See the following guides for more information:
- `SETUP_GUIDE.md` - Detailed setup instructions
- `QUICK_START.md` - Quick start guide
- `Attributions.md` - Third-party attributions

## 🤝 Contributing

This is a proprietary project for Bolthouse Farms. For internal contributions:
1. Create a feature branch
2. Make your changes
3. Submit a pull request

## 📄 License

Proprietary - Bolthouse Farms

## 💡 Tips

- Use Chrome DevTools for debugging
- Check the console for any errors
- All data is generated client-side (no backend needed)
- Mock data is consistent across sessions
- Responsive design works best on desktop and tablet

## 🐛 Troubleshooting

**Charts not displaying?**
- Check that Recharts is installed: `npm list recharts`
- Verify chart data is being generated in console

**Styles not loading?**
- Ensure `globals.css` is imported in `main.tsx`
- Check Tailwind config content paths

**TypeScript errors?**
- Run `npm install` to ensure all types are installed
- Check `tsconfig.json` configuration

**Build failing?**
- Clear node_modules: `rm -rf node_modules && npm install`
- Update dependencies: `npm update`

## 📞 Support

For technical support, contact the development team or refer to the internal wiki.

---

Built with ❤️ for Bolthouse Farms
