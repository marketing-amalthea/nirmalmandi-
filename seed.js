/**
 * NirmalMandi — Comprehensive Seed Script
 * Target: 20+ Cr GMV, 20+ listings per sector, max parameters filled
 */
const { Client } = require('pg');

const DB = 'postgresql://neondb_owner:npg_jTInsvAXN8k7@ep-snowy-sound-aovv6nm9.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

// ── Simple UUID v4 generator ──────────────────────────────────
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max, dp = 2) { return parseFloat((Math.random() * (max - min) + min).toFixed(dp)); }

// ── Reference data ─────────────────────────────────────────────
const SECTORS = [
  { id: 'b5cb8935-cf1c-43af-a7d8-1791ee4ec117', name: 'Automobiles',           slug: 'automobiles' },
  { id: '7ef70f23-4078-4e0d-af96-dc0989e2ae9c', name: 'Clothing & Textiles',   slug: 'clothing' },
  { id: '59c9c157-52fb-45cf-afe1-5f8ab48dd76e', name: 'FMCG & Food',           slug: 'fmcg' },
  { id: '075530ac-8ccb-4042-abf7-03d044ee6d7a', name: 'Furniture',             slug: 'furniture' },
  { id: '083edb57-efa5-4ad9-859c-d7f7866b543b', name: 'Industrial Machinery',  slug: 'machinery' },
  { id: '142da4ad-f331-45da-9525-5d9d83867319', name: 'Pharma & Healthcare',   slug: 'pharma' },
  { id: '7633c8a6-6d81-4592-824a-a2241f7f5b11', name: 'Software & Licenses',   slug: 'software' },
];

const STATES = ['Maharashtra','Delhi','Gujarat','Tamil Nadu','Karnataka','Rajasthan','Uttar Pradesh','West Bengal','Telangana','Punjab','Haryana','Madhya Pradesh'];
const CITIES = {
  'Maharashtra': ['Mumbai','Pune','Nagpur','Nashik','Aurangabad'],
  'Delhi': ['New Delhi','Noida','Gurugram','Faridabad','Ghaziabad'],
  'Gujarat': ['Ahmedabad','Surat','Vadodara','Rajkot','Gandhinagar'],
  'Tamil Nadu': ['Chennai','Coimbatore','Madurai','Trichy','Salem'],
  'Karnataka': ['Bengaluru','Mysuru','Hubli','Mangaluru','Belagavi'],
  'Rajasthan': ['Jaipur','Jodhpur','Udaipur','Kota','Ajmer'],
  'Uttar Pradesh': ['Lucknow','Kanpur','Agra','Varanasi','Meerut'],
  'West Bengal': ['Kolkata','Howrah','Durgapur','Siliguri','Asansol'],
  'Telangana': ['Hyderabad','Warangal','Nizamabad','Karimnagar','Khammam'],
  'Punjab': ['Ludhiana','Amritsar','Jalandhar','Patiala','Bathinda'],
  'Haryana': ['Faridabad','Gurugram','Panipat','Ambala','Sonipat'],
  'Madhya Pradesh': ['Bhopal','Indore','Jabalpur','Gwalior','Rewa'],
};

function getCity(state) {
  return pick(CITIES[state] || ['Mumbai']);
}

// ── Seller data ────────────────────────────────────────────────
const SELLERS = [
  { name: 'Rajesh Kumar', business: 'Rajesh Auto Parts Pvt Ltd',     gst: '27AABCR1234A1Z5', state: 'Maharashtra',    city: 'Pune' },
  { name: 'Priya Sharma', business: 'Sharma Textiles & Fabrics',     gst: '09AABCS5678B2Z3', state: 'Uttar Pradesh', city: 'Kanpur' },
  { name: 'Amit Patel',   business: 'Patel FMCG Distributors',       gst: '24AAACP2345C3Z1', state: 'Gujarat',       city: 'Surat' },
  { name: 'Sunita Verma', business: 'Verma Furniture House',         gst: '08AABCV4567D4Z9', state: 'Rajasthan',     city: 'Jaipur' },
  { name: 'Kiran Reddy',  business: 'Reddy Industrial Solutions',    gst: '36AABCR7890E5Z7', state: 'Telangana',     city: 'Hyderabad' },
  { name: 'Manish Gupta', business: 'Gupta Pharma Wholesale',        gst: '07AABCG3456F6Z5', state: 'Delhi',         city: 'New Delhi' },
  { name: 'Deepa Nair',   business: 'Nair Software Solutions',       gst: '29AABCN6789G7Z3', state: 'Karnataka',     city: 'Bengaluru' },
  { name: 'Sanjay Singh', business: 'Singh Auto Accessories',        gst: '04AABCS9012H8Z1', state: 'Punjab',        city: 'Ludhiana' },
  { name: 'Kavitha Rao',  business: 'Rao Garments Exports',          gst: '33AABCR2345I9Z9', state: 'Tamil Nadu',    city: 'Coimbatore' },
  { name: 'Vikram Joshi', business: 'Joshi Machinery & Equipment',   gst: '27AABCJ5678J0Z7', state: 'Maharashtra',   city: 'Nagpur' },
  { name: 'Anita Mehta',  business: 'Mehta Consumer Goods',          gst: '24AABCM8901K1Z5', state: 'Gujarat',       city: 'Ahmedabad' },
  { name: 'Ravi Chandra', business: 'Chandra Pharma Distributors',   gst: '36AABCC1234L2Z3', state: 'Telangana',     city: 'Warangal' },
];

// ── Buyer data ─────────────────────────────────────────────────
const BUYERS = [
  { name: 'Arjun Kapoor',   business: 'Kapoor Trading Co',          state: 'Delhi',          gst: '07AABCK1111A1Z5' },
  { name: 'Meena Pillai',   business: 'Pillai Retail Ventures',     state: 'Tamil Nadu',     gst: '33AABCP2222B2Z3' },
  { name: 'Rohit Agarwal',  business: 'Agarwal Brothers Wholesale', state: 'Uttar Pradesh',  gst: '09AABCA3333C3Z1' },
  { name: 'Smita Desai',    business: 'Desai Distributors',         state: 'Maharashtra',    gst: '27AABCD4444D4Z9' },
  { name: 'Naresh Yadav',   business: 'Yadav Enterprises',          state: 'Haryana',        gst: '06AABCY5555E5Z7' },
  { name: 'Pooja Malhotra', business: 'Malhotra Import Export',     state: 'Punjab',         gst: '03AABCM6666F6Z5' },
  { name: 'Suresh Babu',    business: 'Babu Trading Corporation',   state: 'Karnataka',      gst: '29AABCB7777G7Z3' },
  { name: 'Lalitha Kumari', business: 'Kumari Wholesale Mart',      state: 'Telangana',      gst: '36AABCK8888H8Z1' },
  { name: 'Mahesh Patil',   business: 'Patil Retail Chain',         state: 'Maharashtra',    gst: '27AABCP9999I9Z9' },
  { name: 'Divya Krishnan', business: 'Krishnan Traders',           state: 'Tamil Nadu',     gst: '33AABCK0000J0Z7' },
  { name: 'Gaurav Tiwari',  business: 'Tiwari Bulk Buyers',         state: 'Madhya Pradesh', gst: '23AABCT1234K1Z5' },
  { name: 'Rekha Saxena',   business: 'Saxena Commercial House',    state: 'Rajasthan',      gst: '08AABCS5678L2Z3' },
  { name: 'Ajay Pandey',    business: 'Pandey Wholesale Group',     state: 'West Bengal',    gst: '19AABCP9012M3Z1' },
  { name: 'Nisha Iyer',     business: 'Iyer Supply Chain',          state: 'Karnataka',      gst: '29AABCI3456N4Z9' },
  { name: 'Prakash Rao',    business: 'Rao Procurement Services',   state: 'Gujarat',        gst: '24AABCR7890O5Z7' },
];

// ── Listings per sector ────────────────────────────────────────
const SECTOR_LISTINGS = {
  automobiles: [
    { title: 'Maruti Alto 800 Genuine Spare Parts Kit — Dead Stock 2022', unit: 'sets',    qty: [200,800],   price: [4500,18000],   mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'Tata Nexon Bumper Guards — Overrun Batch 2023',             unit: 'pieces',  qty: [100,400],   price: [2200,6500],    mrp_mult: 2.1, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'Bosch Automotive Fuel Injectors — Obsolete SKUs',           unit: 'pieces',  qty: [50,200],    price: [3500,12000],   mrp_mult: 2.5, type: 'obsolete',  grade: 'B', lot: 'full_lot' },
    { title: 'MRF Car Tyres 185/65 R14 — Near Expiry Date Stock',        unit: 'pieces',  qty: [80,350],    price: [2800,5500],    mrp_mult: 1.9, type: 'near_expiry',grade: 'A', lot: 'full_lot' },
    { title: 'Honda Activa CVT Belt Set — Seasonal Overstock',           unit: 'sets',    qty: [150,600],   price: [800,2200],     mrp_mult: 2.2, type: 'seasonal',  grade: 'A', lot: 'partial' },
    { title: 'Amaron Car Battery 35Ah — Damaged Outer Packaging',        unit: 'pieces',  qty: [60,250],    price: [3200,7500],    mrp_mult: 1.6, type: 'damaged_packaging', grade: 'B', lot: 'partial' },
    { title: 'Exide Inverter Battery 150Ah — Excess Warehouse Stock',    unit: 'pieces',  qty: [30,120],    price: [8500,15000],   mrp_mult: 1.7, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'Wiper Blade Set Universal 20" + 18" — Returns Stock',      unit: 'pairs',   qty: [200,1000],  price: [250,800],      mrp_mult: 2.8, type: 'returns',   grade: 'B', lot: 'full_lot' },
    { title: 'Mahindra Scorpio Alloy Wheel Set — Discontinued Model',    unit: 'sets',    qty: [20,80],     price: [18000,45000],  mrp_mult: 2.0, type: 'obsolete',  grade: 'A', lot: 'full_lot' },
    { title: 'Bajaj Pulsar Engine Oil 20W-50 1L — Near Expiry',         unit: 'pieces',  qty: [500,3000],  price: [180,320],      mrp_mult: 1.5, type: 'near_expiry',grade: 'B', lot: 'full_lot' },
    { title: 'Hero Splendor Headlight Assembly LED — Old Model Stock',   unit: 'pieces',  qty: [100,500],   price: [1200,3500],    mrp_mult: 2.3, type: 'obsolete',  grade: 'A', lot: 'partial' },
    { title: 'Denso Spark Plugs BKR6E — Excess Inventory Lot',          unit: 'pieces',  qty: [1000,5000], price: [85,220],       mrp_mult: 2.0, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Car Seat Cover Set Universal — Clearance Stock',           unit: 'sets',    qty: [100,400],   price: [850,2800],     mrp_mult: 2.5, type: 'seasonal',  grade: 'B', lot: 'partial' },
    { title: 'Minda Horn Assembly 12V — Returns & B-grade Units',        unit: 'pieces',  qty: [200,800],   price: [180,550],      mrp_mult: 2.2, type: 'returns',   grade: 'B', lot: 'partial' },
    { title: 'Maruti Suzuki Air Filter Set — Overstocked Dead SKUs',     unit: 'pieces',  qty: [300,1500],  price: [320,850],      mrp_mult: 2.1, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Royal Enfield Classic 350 Parts Kit — Discontinued',      unit: 'kits',    qty: [30,150],    price: [5500,18000],   mrp_mult: 2.4, type: 'obsolete',  grade: 'A', lot: 'full_lot' },
    { title: 'Clutch Plate Assembly — Multi-Brand Dead Inventory',       unit: 'pieces',  qty: [150,600],   price: [650,2200],     mrp_mult: 2.0, type: 'excess',    grade: 'B', lot: 'full_lot' },
    { title: 'Yokohama Car Tyres 195/65 R15 — Old Year Stock 2022',     unit: 'pieces',  qty: [40,180],    price: [4200,7500],    mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'Rear View Mirror Assembly Hyundai Creta — Overrun',        unit: 'pieces',  qty: [80,350],    price: [1800,4500],    mrp_mult: 2.2, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'Automotive Brake Pads Multi-Car Fitment — Seasonal',       unit: 'sets',    qty: [200,1000],  price: [350,1200],     mrp_mult: 2.3, type: 'seasonal',  grade: 'B', lot: 'full_lot' },
  ],
  clothing: [
    { title: 'Cotton Kurta Set — Winter 2023 Overstock, XS–5XL',        unit: 'pieces',  qty: [500,3000],  price: [85,250],       mrp_mult: 3.5, type: 'seasonal',  grade: 'A', lot: 'full_lot' },
    { title: 'Formal Shirt Men — Discontinued Colour Run',               unit: 'pieces',  qty: [300,1500],  price: [120,380],      mrp_mult: 3.2, type: 'obsolete',  grade: 'A', lot: 'partial' },
    { title: 'Denim Jeans — Export Returns B-Grade Lot',                 unit: 'pieces',  qty: [200,1000],  price: [180,550],      mrp_mult: 4.0, type: 'returns',   grade: 'B', lot: 'full_lot' },
    { title: 'Silk Sarees Kanchipuram — Dead Season Inventory',          unit: 'pieces',  qty: [50,200],    price: [850,3500],     mrp_mult: 2.8, type: 'seasonal',  grade: 'A', lot: 'partial' },
    { title: 'Kids School Uniform Sets — Post-Season Clearance',         unit: 'sets',    qty: [400,2000],  price: [180,420],      mrp_mult: 2.5, type: 'seasonal',  grade: 'A', lot: 'full_lot' },
    { title: 'Sports T-Shirt Polyester — Brand Overrun 2023',            unit: 'pieces',  qty: [500,2500],  price: [65,180],       mrp_mult: 3.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Cotton Fabric Grey — Mill Overrun Rolls',                  unit: 'meters',  qty: [2000,10000],price: [18,65],        mrp_mult: 2.2, type: 'excess',    grade: 'B', lot: 'full_lot' },
    { title: 'Woollen Shawl — End-of-Season Lot, Himachal Origin',      unit: 'pieces',  qty: [200,800],   price: [350,1200],     mrp_mult: 3.0, type: 'seasonal',  grade: 'A', lot: 'partial' },
    { title: 'Ladies Lehenga — Wedding Season Leftovers',                unit: 'pieces',  qty: [80,300],    price: [550,2200],     mrp_mult: 3.5, type: 'seasonal',  grade: 'B', lot: 'partial' },
    { title: 'Hosiery Socks Lot — 3-Pair Pack, Damaged Box Stock',      unit: 'packs',   qty: [1000,5000], price: [22,65],        mrp_mult: 3.2, type: 'damaged_packaging', grade: 'B', lot: 'full_lot' },
    { title: 'Blazer Men — Old Season Export Rejects',                   unit: 'pieces',  qty: [100,400],   price: [380,1200],     mrp_mult: 4.5, type: 'returns',   grade: 'B', lot: 'partial' },
    { title: 'Polyester Saree — Festival Overstock Lot',                 unit: 'pieces',  qty: [300,1500],  price: [95,280],       mrp_mult: 2.8, type: 'seasonal',  grade: 'A', lot: 'full_lot' },
    { title: 'Linen Fabric Rolls — Import Overstock, 58" Width',        unit: 'meters',  qty: [1000,5000], price: [45,120],       mrp_mult: 2.5, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Winter Jacket — Old Season Stock 2022–23',                 unit: 'pieces',  qty: [150,600],   price: [280,850],      mrp_mult: 3.8, type: 'seasonal',  grade: 'A', lot: 'partial' },
    { title: 'Cotton Dhoti — Rural Surplus, Ready for Liquidation',      unit: 'pieces',  qty: [500,2500],  price: [55,150],       mrp_mult: 2.2, type: 'excess',    grade: 'B', lot: 'full_lot' },
    { title: 'Innerwear Combo Set — Rejected Export, Premium Grade',     unit: 'sets',    qty: [400,2000],  price: [75,180],       mrp_mult: 3.0, type: 'returns',   grade: 'B', lot: 'full_lot' },
    { title: 'Embroidered Dupatta — Artisan Overrun Batch',              unit: 'pieces',  qty: [200,1000],  price: [120,380],      mrp_mult: 3.5, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'Track Pants — Sports Brand Overrun Season 2023',           unit: 'pieces',  qty: [400,2000],  price: [95,250],       mrp_mult: 3.2, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Premium Cotton Bedsheet Set — Hotel Surplus Stock',        unit: 'sets',    qty: [100,500],   price: [380,1200],     mrp_mult: 2.8, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'Synthetic Saree — Wedding Season Clearance Lot',           unit: 'pieces',  qty: [600,3000],  price: [55,150],       mrp_mult: 3.0, type: 'seasonal',  grade: 'B', lot: 'full_lot' },
  ],
  fmcg: [
    { title: 'Parle-G Biscuits — Near Expiry 3-Month Shelf Life',        unit: 'cartons', qty: [100,500],   price: [1200,2200],    mrp_mult: 1.4, type: 'near_expiry',grade: 'A', lot: 'full_lot' },
    { title: 'Colgate Toothpaste 200ml — Damaged Box Outer, Intact Tube',unit: 'pieces',  qty: [500,3000],  price: [38,68],        mrp_mult: 1.6, type: 'damaged_packaging', grade: 'B', lot: 'full_lot' },
    { title: 'Surf Excel Detergent 1kg — Excess Distributor Stock',      unit: 'bags',    qty: [300,1500],  price: [85,145],       mrp_mult: 1.5, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Maggi Noodles 70g — Festival Season Overrun',              unit: 'cartons', qty: [200,1000],  price: [480,850],      mrp_mult: 1.4, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Dove Soap Bar 100g — Discontinued Variant',                unit: 'pieces',  qty: [1000,5000], price: [28,55],        mrp_mult: 1.7, type: 'obsolete',  grade: 'A', lot: 'full_lot' },
    { title: 'Tata Salt 1kg — Damaged Packing Stock, Salt Intact',       unit: 'bags',    qty: [500,2500],  price: [18,28],        mrp_mult: 1.3, type: 'damaged_packaging', grade: 'B', lot: 'full_lot' },
    { title: 'Sunflower Cooking Oil 1L — Near Expiry 2 Months',          unit: 'bottles', qty: [200,1000],  price: [95,145],       mrp_mult: 1.4, type: 'near_expiry',grade: 'A', lot: 'full_lot' },
    { title: 'Britannia Marie Gold Biscuits — Seasonal Festival Stock',   unit: 'cartons', qty: [80,400],    price: [950,1800],     mrp_mult: 1.5, type: 'seasonal',  grade: 'A', lot: 'full_lot' },
    { title: 'Head & Shoulders Shampoo 200ml — Old Packaging',           unit: 'bottles', qty: [300,1500],  price: [65,120],       mrp_mult: 1.8, type: 'obsolete',  grade: 'A', lot: 'partial' },
    { title: 'Dettol Handwash 200ml — COVID-Era Overstock',              unit: 'bottles', qty: [500,3000],  price: [45,75],        mrp_mult: 1.6, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Kissan Jam Mixed Fruit 500g — Near Expiry 45 Days',        unit: 'jars',    qty: [200,1000],  price: [68,110],       mrp_mult: 1.5, type: 'near_expiry',grade: 'B', lot: 'full_lot' },
    { title: 'Fortune Basmati Rice 5kg — Excess Warehouse Stock',        unit: 'bags',    qty: [200,1000],  price: [380,620],      mrp_mult: 1.4, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Lux Beauty Soap — Export Returns, Outer Box Damaged',      unit: 'pieces',  qty: [1000,5000], price: [22,42],        mrp_mult: 1.9, type: 'damaged_packaging', grade: 'B', lot: 'full_lot' },
    { title: 'Amul Ghee 1L Tin — Slow-Moving Retailer Stock',            unit: 'tins',    qty: [100,600],   price: [520,680],      mrp_mult: 1.3, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'Red Label Tea 500g — Discontined Packaging Version',       unit: 'packs',   qty: [500,2500],  price: [145,225],      mrp_mult: 1.6, type: 'obsolete',  grade: 'A', lot: 'full_lot' },
    { title: 'Nescafe Classic 100g — Oversupplied SKU, Intact Seals',    unit: 'jars',    qty: [300,1500],  price: [165,265],      mrp_mult: 1.7, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Vim Dishwash Bar 200g — Returns from Retail Chain',        unit: 'pieces',  qty: [800,4000],  price: [18,32],        mrp_mult: 1.5, type: 'returns',   grade: 'B', lot: 'full_lot' },
    { title: 'Everest Masala Mix — Bulk Export Overrun Lot',             unit: 'kg',      qty: [100,600],   price: [180,320],      mrp_mult: 2.0, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Kurkure Snacks — Near Expiry Batch, 1 Month Left',         unit: 'cartons', qty: [50,250],    price: [750,1350],     mrp_mult: 1.4, type: 'near_expiry',grade: 'A', lot: 'full_lot' },
    { title: 'Dettol Antiseptic Liquid 500ml — Overrun COVID Stock',     unit: 'bottles', qty: [200,1000],  price: [95,165],       mrp_mult: 1.6, type: 'excess',    grade: 'A', lot: 'full_lot' },
  ],
  furniture: [
    { title: 'Office Chairs Ergonomic — Corporate Order Cancellation',   unit: 'pieces',  qty: [20,100],    price: [4500,12000],   mrp_mult: 2.5, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Wooden Study Table — Damaged in Transit, Minor Scratches', unit: 'pieces',  qty: [15,60],     price: [3500,8500],    mrp_mult: 2.8, type: 'returns',   grade: 'B', lot: 'partial' },
    { title: 'Steel Almirah 3-Door — End-of-Season Factory Excess',     unit: 'pieces',  qty: [10,50],     price: [6500,14500],   mrp_mult: 2.0, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Sofa Set 5-Seater — Hotel Furniture Clearance',            unit: 'sets',    qty: [5,25],      price: [22000,55000],  mrp_mult: 2.2, type: 'excess',    grade: 'B', lot: 'partial' },
    { title: 'Plastic Stacking Chairs — Overrun Event Supply',           unit: 'pieces',  qty: [100,500],   price: [380,750],      mrp_mult: 2.5, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Queen Bed Frame Teak Wood — Discontinued Model',           unit: 'pieces',  qty: [8,35],      price: [12000,28000],  mrp_mult: 2.8, type: 'obsolete',  grade: 'A', lot: 'partial' },
    { title: 'Modular Kitchen Cabinets — Builder Project Cancelled',     unit: 'sets',    qty: [5,20],      price: [45000,120000], mrp_mult: 2.0, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Computer Workstation Table — IT Company Liquidation',      unit: 'pieces',  qty: [15,80],     price: [4500,9500],    mrp_mult: 2.3, type: 'excess',    grade: 'B', lot: 'full_lot' },
    { title: 'Mattress — Hotel Surplus, Spring & Memory Foam',          unit: 'pieces',  qty: [20,100],    price: [5500,18000],   mrp_mult: 2.6, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Dining Table 6-Seater — Warehouse Overstock',              unit: 'sets',    qty: [8,40],      price: [12000,32000],  mrp_mult: 2.4, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'Steel Rack Shelving — Factory Surplus Clearance',          unit: 'sets',    qty: [20,100],    price: [3500,9500],    mrp_mult: 2.2, type: 'excess',    grade: 'B', lot: 'full_lot' },
    { title: 'Recliner Chair — Customer Return Minor Issue',             unit: 'pieces',  qty: [5,25],      price: [12000,28000],  mrp_mult: 3.0, type: 'returns',   grade: 'B', lot: 'partial' },
    { title: 'Folding Table — Trade Show Display Stock',                 unit: 'pieces',  qty: [30,150],    price: [1800,4500],    mrp_mult: 2.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Wardrobe 4-Door Mirror — Overproduction Lot',              unit: 'pieces',  qty: [10,50],     price: [8500,22000],   mrp_mult: 2.5, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'Hospital Bed Manual — Government Tender Surplus',          unit: 'pieces',  qty: [10,40],     price: [18000,45000],  mrp_mult: 2.0, type: 'excess',    grade: 'B', lot: 'full_lot' },
    { title: 'Office Reception Sofa — Corporate Relocation Stock',       unit: 'sets',    qty: [4,20],      price: [22000,58000],  mrp_mult: 2.5, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'PVC Patio Chairs — Post-Monsoon Clearance',               unit: 'pieces',  qty: [50,250],    price: [1200,3200],    mrp_mult: 2.8, type: 'seasonal',  grade: 'A', lot: 'full_lot' },
    { title: 'Baby Crib — Import Return, Assembly Intact',               unit: 'pieces',  qty: [10,50],     price: [5500,12000],   mrp_mult: 3.0, type: 'returns',   grade: 'B', lot: 'partial' },
    { title: 'Bean Bag XXL — Old Model Clearance Lot',                   unit: 'pieces',  qty: [30,150],    price: [1800,4200],    mrp_mult: 2.8, type: 'obsolete',  grade: 'A', lot: 'full_lot' },
    { title: 'Bar Stool Set — Restaurant Chain Liquidation',             unit: 'pieces',  qty: [20,100],    price: [2800,7500],    mrp_mult: 2.5, type: 'excess',    grade: 'B', lot: 'full_lot' },
  ],
  machinery: [
    { title: 'Air Compressor 2HP 50L — Workshop Excess Stock',           unit: 'pieces',  qty: [5,25],      price: [12000,28000],  mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Industrial Water Pump 1HP — Damaged Packaging, Pump OK',   unit: 'pieces',  qty: [10,50],     price: [5500,12000],   mrp_mult: 1.9, type: 'damaged_packaging', grade: 'B', lot: 'partial' },
    { title: 'CNC Machine Parts Kit — Discontinued Model Spares',        unit: 'kits',    qty: [5,20],      price: [25000,75000],  mrp_mult: 2.2, type: 'obsolete',  grade: 'A', lot: 'full_lot' },
    { title: 'Electric Motor 5HP — Factory Closed, Surplus',             unit: 'pieces',  qty: [8,40],      price: [18000,45000],  mrp_mult: 1.7, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Diesel Generator 15kVA — Event Rental Fleet Sale',         unit: 'pieces',  qty: [3,12],      price: [85000,180000], mrp_mult: 1.6, type: 'excess',    grade: 'B', lot: 'partial' },
    { title: 'Hydraulic Jack 10-Ton — Workshop Equipment Liquidation',   unit: 'pieces',  qty: [10,50],     price: [4500,12000],   mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Industrial Drill Press — Old Model Replaced with CNC',     unit: 'pieces',  qty: [3,15],      price: [22000,55000],  mrp_mult: 1.9, type: 'obsolete',  grade: 'B', lot: 'full_lot' },
    { title: 'Welding Machine 250A MIG — Returns from Rental Fleet',     unit: 'pieces',  qty: [5,25],      price: [12000,28000],  mrp_mult: 2.0, type: 'returns',   grade: 'B', lot: 'partial' },
    { title: 'Solar Panel 330W Monocrystalline — Damaged Frame',         unit: 'pieces',  qty: [20,100],    price: [6500,12000],   mrp_mult: 1.7, type: 'damaged_packaging', grade: 'B', lot: 'full_lot' },
    { title: 'Industrial Fan 48" — Seasonal Overstock, Brand New',       unit: 'pieces',  qty: [10,50],     price: [8500,18000],   mrp_mult: 1.8, type: 'seasonal',  grade: 'A', lot: 'full_lot' },
    { title: 'Conveyor Belt Motor — Plant Upgrade Surplus Parts',        unit: 'pieces',  qty: [5,20],      price: [15000,38000],  mrp_mult: 1.9, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Lathe Machine 6-Foot — Factory Relocation, Second-Hand A', unit: 'pieces',  qty: [2,8],       price: [65000,150000], mrp_mult: 1.7, type: 'excess',    grade: 'B', lot: 'full_lot' },
    { title: 'Submersible Pump 2HP — Government Project Surplus',        unit: 'pieces',  qty: [10,60],     price: [8500,18000],   mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Industrial Weighing Scale 500kg — Calibrated',            unit: 'pieces',  qty: [5,25],      price: [12000,25000],  mrp_mult: 2.0, type: 'excess',    grade: 'A', lot: 'partial' },
    { title: 'Pressure Washer 150 Bar — Rental Fleet Disposal',          unit: 'pieces',  qty: [5,20],      price: [18000,38000],  mrp_mult: 1.9, type: 'returns',   grade: 'B', lot: 'full_lot' },
    { title: 'Band Saw Machine — Workshop Upgrade Surplus',              unit: 'pieces',  qty: [3,12],      price: [22000,55000],  mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Forklift Electric 1.5T — Warehouse Closing Stock',         unit: 'pieces',  qty: [2,6],       price: [180000,380000],mrp_mult: 1.6, type: 'excess',    grade: 'B', lot: 'full_lot' },
    { title: 'Industrial UPS 10kVA — Data Centre Upgrade',              unit: 'pieces',  qty: [3,15],      price: [35000,85000],  mrp_mult: 1.9, type: 'obsolete',  grade: 'A', lot: 'full_lot' },
    { title: 'Pneumatic Tools Kit — Factory Clearance Lot',              unit: 'kits',    qty: [5,25],      price: [8500,22000],   mrp_mult: 2.1, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'RO Water Purifier Industrial 500LPH — Project Cancelled', unit: 'pieces',  qty: [3,12],      price: [45000,95000],  mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
  ],
  pharma: [
    { title: 'Paracetamol 500mg Tablets — 4-Month Expiry, Strips',      unit: 'strips',  qty: [5000,25000],price: [12,22],        mrp_mult: 2.5, type: 'near_expiry',grade: 'A', lot: 'full_lot' },
    { title: 'Surgical Gloves Latex M/L — COVID Surplus Stock',          unit: 'boxes',   qty: [200,1000],  price: [220,380],      mrp_mult: 2.0, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'N95 Masks — Post-Pandemic Overstock, CDSCO Approved',     unit: 'boxes',   qty: [500,3000],  price: [280,480],      mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Surgical Disposable Syringes 5ml — Hospital Surplus',     unit: 'boxes',   qty: [100,600],   price: [350,650],      mrp_mult: 2.2, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Azithromycin 500mg — 3-Month Expiry, Loose Strips',       unit: 'strips',  qty: [2000,10000],price: [22,38],        mrp_mult: 2.8, type: 'near_expiry',grade: 'A', lot: 'full_lot' },
    { title: 'Pulse Oximeter — Old Model Overstock, CE Certified',       unit: 'pieces',  qty: [50,250],    price: [380,650],      mrp_mult: 2.5, type: 'obsolete',  grade: 'A', lot: 'partial' },
    { title: 'Antiseptic Dressing Kit — Hospital Order Cancelled',       unit: 'kits',    qty: [200,1000],  price: [85,165],       mrp_mult: 2.0, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'IV Infusion Set — Manufacturer Excess, Near Expiry',      unit: 'pieces',  qty: [1000,5000], price: [18,32],        mrp_mult: 2.2, type: 'near_expiry',grade: 'A', lot: 'full_lot' },
    { title: 'BP Monitor Digital — Export Returns, Warranty Period',     unit: 'pieces',  qty: [30,150],    price: [850,1800],     mrp_mult: 2.8, type: 'returns',   grade: 'B', lot: 'partial' },
    { title: 'Thermometer Infrared — COVID-Era Import Overstock',        unit: 'pieces',  qty: [100,500],   price: [280,550],      mrp_mult: 2.2, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Isopropyl Alcohol 99% — 5L Can, 2-Month Expiry',          unit: 'cans',    qty: [100,500],   price: [380,580],      mrp_mult: 1.8, type: 'near_expiry',grade: 'A', lot: 'full_lot' },
    { title: 'Medical-Grade PPE Kit — Government Tender Surplus',        unit: 'pieces',  qty: [500,2500],  price: [120,220],      mrp_mult: 1.9, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Dolo 650mg — Pharmacy Return Strips, Intact Packaging',   unit: 'strips',  qty: [3000,15000],price: [18,28],        mrp_mult: 2.5, type: 'returns',   grade: 'B', lot: 'full_lot' },
    { title: 'Cetrizine 10mg — Distributor Dead Stock, 3-Month Expiry', unit: 'strips',  qty: [2000,8000], price: [8,15],         mrp_mult: 3.0, type: 'near_expiry',grade: 'A', lot: 'full_lot' },
    { title: 'Surgical Scissors Stainless — Hospital Procurement Excess',unit: 'pieces',  qty: [50,250],    price: [180,420],      mrp_mult: 2.5, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Vitamin C 1000mg Effervescent — Seasonal Overstock',       unit: 'strips',  qty: [1000,5000], price: [28,55],        mrp_mult: 2.8, type: 'seasonal',  grade: 'A', lot: 'full_lot' },
    { title: 'Nebulizer Machine — B-Grade Cosmetic Defect, Works Fine',  unit: 'pieces',  qty: [20,100],    price: [1800,3500],    mrp_mult: 2.5, type: 'returns',   grade: 'B', lot: 'partial' },
    { title: 'Gauze Bandage Roll — Government Hospital Surplus',         unit: 'rolls',   qty: [2000,10000],price: [8,18],         mrp_mult: 2.2, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Hand Sanitizer 500ml — 6-Month Expiry, Brand Surplus',    unit: 'bottles', qty: [300,1500],  price: [55,95],        mrp_mult: 1.7, type: 'near_expiry',grade: 'A', lot: 'full_lot' },
    { title: 'Glucometer Strips 50-Test — Near Expiry, Sealed Pack',    unit: 'packs',   qty: [200,1000],  price: [180,320],      mrp_mult: 2.5, type: 'near_expiry',grade: 'A', lot: 'full_lot' },
  ],
  software: [
    { title: 'Microsoft Office 365 Business Licences — Bulk Unused',     unit: 'licenses',qty: [10,100],    price: [2800,4500],    mrp_mult: 2.0, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Adobe Creative Cloud 1-Year — Corporate Surplus Keys',     unit: 'licenses',qty: [5,50],      price: [12000,18000],  mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Tally Prime — Unused Activation Codes, Single User',      unit: 'licenses',qty: [10,80],     price: [8500,12000],   mrp_mult: 1.9, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Windows 11 Pro OEM Keys — Surplus from PC Manufacturer',  unit: 'licenses',qty: [20,200],    price: [5500,8500],    mrp_mult: 1.7, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'AutoCAD LT 1-Year Subscription — Company Downsizing',     unit: 'seats',   qty: [5,30],      price: [22000,38000],  mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'QuickBooks Enterprise — Unused Multi-User Pack',           unit: 'licenses',qty: [5,25],      price: [18000,32000],  mrp_mult: 1.9, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Antivirus 3-Year — Kaspersky Total Security Multi-Device', unit: 'licenses',qty: [20,150],    price: [1800,3200],    mrp_mult: 2.2, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'SAP Business One — Demo Licences, Converted to Dead',      unit: 'licenses',qty: [3,15],      price: [85000,150000], mrp_mult: 1.6, type: 'obsolete',  grade: 'A', lot: 'full_lot' },
    { title: 'Zoom Pro Annual — Corporate Subscription Cancellation',    unit: 'seats',   qty: [10,100],    price: [8500,12000],   mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'AWS Reserved Instances — Prepaid Credits Transferable',    unit: 'units',   qty: [5,30],      price: [15000,45000],  mrp_mult: 1.7, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Salesforce CRM Seats — Startup Closure Surplus',           unit: 'seats',   qty: [5,40],      price: [22000,45000],  mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Slack Business Licenses — Company Merger Duplicate',       unit: 'seats',   qty: [10,80],     price: [5500,9500],    mrp_mult: 1.9, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Photoshop CC Annual — Design Agency Downsizing Licences',  unit: 'licenses',qty: [5,30],      price: [15000,22000],  mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'HRMS Software 1-Year — Startup Shutdown Unused Pack',     unit: 'licenses',qty: [5,20],      price: [18000,55000],  mrp_mult: 1.7, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'ERP System — Mid-Market, Unused Modules Liquidation',      unit: 'licenses',qty: [2,8],       price: [85000,220000], mrp_mult: 1.6, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Domain + Hosting 5-Year Bundle — Web Agency Closing',     unit: 'licenses',qty: [10,50],     price: [3500,8500],    mrp_mult: 2.0, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'VPN Software 2-Year Corporate — Unused Bulk Activation',  unit: 'seats',   qty: [20,200],    price: [1800,3200],    mrp_mult: 2.2, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Cybersecurity Suite Enterprise — 3-Year Prepaid Unused',   unit: 'licenses',qty: [3,15],      price: [45000,120000], mrp_mult: 1.7, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Video Editing Software DaVinci — Studio Closure Lot',     unit: 'licenses',qty: [5,25],      price: [12000,22000],  mrp_mult: 1.9, type: 'excess',    grade: 'A', lot: 'full_lot' },
    { title: 'Power BI Pro Annual — Analytics Team Disbanded Keys',      unit: 'licenses',qty: [5,40],      price: [8500,15000],   mrp_mult: 1.8, type: 'excess',    grade: 'A', lot: 'full_lot' },
  ],
};

// ── Main seed ──────────────────────────────────────────────────
async function seed() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  console.log('✅ Connected to Neon PostgreSQL\n');

  try {
    // ── 0. Wipe existing seed data ───────────────────────────
    console.log('Clearing existing seed data...');
    await client.query(`TRUNCATE notifications, disputes, escrow_accounts, orders, listings RESTART IDENTITY CASCADE`);
    await client.query(`DELETE FROM seller_profiles`);
    await client.query(`DELETE FROM buyer_profiles`);
    await client.query(`DELETE FROM users WHERE role IN ('seller','buyer')`);
    console.log('  ✓ Cleared\n');

    // ── 1. Create Sellers ────────────────────────────────────
    console.log('Creating sellers...');
    const sellerIds = [];      // seller_profiles.id
    const sellerUserIds = [];  // users.id

    for (const s of SELLERS) {
      const userId = uuid();
      const profileId = uuid();
      const phone = '98' + String(rand(10000000, 99999999));
      const createdAt = new Date(Date.now() - rand(30, 365) * 86400000);

      await client.query(
        `INSERT INTO users (id, phone, name, role, status, referral_code, created_at, updated_at)
         VALUES ($1,$2,$3,'seller','active',$4,$5,$5)
`,
        [userId, phone, s.name, 'SEL' + phone.slice(-6), createdAt]
      );

      await client.query(
        `INSERT INTO seller_profiles
           (id, user_id, business_name, business_type, gst_number, verification_tier,
            kyc_status, performance_score, dispute_rate, fulfillment_rate, response_rate,
            total_gmv, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'approved',$7,$8,$9,$10,$11,$12,$12)
`,
        [
          profileId, userId, s.business,
          pick(['manufacturer','distributor','retailer','wholesaler']),
          s.gst,
          pick(['verified','premium','basic']),
          randFloat(3.5, 5.0, 1),
          randFloat(0.01, 0.05, 3),
          randFloat(0.85, 0.99, 2),
          randFloat(0.80, 0.98, 2),
          rand(500000, 5000000),
          createdAt,
        ]
      );
      sellerIds.push(profileId);
      sellerUserIds.push(userId);
    }
    console.log(`  ✓ ${SELLERS.length} sellers created`);

    // ── 2. Create Buyers ─────────────────────────────────────
    console.log('Creating buyers...');
    const buyerIds = [];
    const buyerUserIds = [];

    for (const b of BUYERS) {
      const userId = uuid();
      const profileId = uuid();
      const phone = '97' + String(rand(10000000, 99999999));
      const createdAt = new Date(Date.now() - rand(10, 300) * 86400000);

      await client.query(
        `INSERT INTO users (id, phone, name, role, status, referral_code, created_at, updated_at)
         VALUES ($1,$2,$3,'buyer','active',$4,$5,$5)
`,
        [userId, phone, b.name, 'BUY' + phone.slice(-6), createdAt]
      );

      await client.query(
        `INSERT INTO buyer_profiles
           (id, user_id, business_name, gst_number, verification_tier,
            total_purchases, ai_credits_balance, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
`,
        [
          profileId, userId, b.business, b.gst,
          pick(['tier1','tier2','tier3']),
          rand(100000, 5000000),
          rand(0, 50),
          createdAt,
        ]
      );
      buyerIds.push(profileId);
      buyerUserIds.push(userId);
    }
    console.log(`  ✓ ${BUYERS.length} buyers created`);

    // ── 3. Create Listings (20 per sector) ──────────────────
    console.log('Creating listings...');
    const listingIds = [];

    for (const sector of SECTORS) {
      const sectorListings = SECTOR_LISTINGS[sector.slug] || [];
      const sellerPool = sellerIds.slice(0, 8);

      for (let i = 0; i < sectorListings.length; i++) {
        const tmpl = sectorListings[i];
        const lid = uuid();
        const sellerId = sellerPool[i % sellerPool.length];
        const state = pick(STATES);
        const city = getCity(state);
        const askingPrice = rand(tmpl.price[0], tmpl.price[1]);
        const mrp = Math.round(askingPrice * tmpl.mrp_mult);
        const totalQty = rand(tmpl.qty[0], tmpl.qty[1]);
        const moq = Math.max(1, Math.floor(totalQty * randFloat(0.01, 0.05)));
        const daysAgo = rand(1, 120);
        const createdAt = new Date(Date.now() - daysAgo * 86400000);
        const urgencyDays = rand(7, 60);

        const specificFields = {
          condition_notes: pick(['Mint condition', 'Minor scratches on packaging', 'Fully functional', 'Slight dust', 'Sealed units']),
          storage_condition: pick(['Dry warehouse', 'Climate controlled', 'Standard storage', 'Temperature controlled']),
          reason_for_sale: pick(['Overproduction', 'Model discontinued', 'Near expiry', 'Business closure', 'Excess import', 'Order cancelled']),
          minimum_order_value: moq * askingPrice,
          negotiable: pick([true, false, true, true]),
        };

        await client.query(
          `INSERT INTO listings
             (id, seller_id, sector_id, title, description, dead_stock_type,
              condition_grade, lot_type, total_quantity, available_quantity, moq,
              unit, price_type, asking_price, floor_price, mrp,
              sector_specific_fields, images, state, city,
              urgency_days, urgency_score, is_featured, status,
              views_count, inquiries_count, watchlist_count,
              created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,$14,$15,
                   $16::jsonb,$17::text[],$18,$19,$20,$21,$22,'live',$23,$24,$25,$26,$26)
  `,
          [
            lid, sellerId, sector.id,
            tmpl.title,
            `Dead inventory liquidation — ${sector.name}. ${specificFields.reason_for_sale}. ${specificFields.condition_notes}. Stored in ${specificFields.storage_condition}. GST invoice provided. Bulk buyers preferred. MOQ: ${moq} ${tmpl.unit}. Contact for logistics support.`,
            tmpl.type, tmpl.grade, tmpl.lot,
            totalQty, moq, tmpl.unit,
            pick(['fixed','offer','fixed','fixed']),
            askingPrice,
            Math.round(askingPrice * 0.85),
            mrp,
            JSON.stringify(specificFields),
            [`https://cdn.nirmalmandi.com/listings/${lid}/1.jpg`, `https://cdn.nirmalmandi.com/listings/${lid}/2.jpg`],
            state, city,
            urgencyDays,
            Math.max(0, 10 - Math.floor(urgencyDays / 7)),
            i < 4, // first 4 per sector are featured
            rand(50, 2500),
            rand(2, 80),
            rand(1, 40),
            createdAt,
          ]
        );
        listingIds.push({ id: lid, sellerId, price: askingPrice, unit: tmpl.unit, qty: totalQty, sector: sector.slug });
      }
      console.log(`  ✓ ${sectorListings.length} listings for ${sector.name}`);
    }

    // ── 4. Create Orders + Escrow (targeting 22+ Cr GMV) ────
    console.log('\nCreating orders and escrow...');

    const ORDER_STATUSES = [
      ...Array(100).fill('completed'),
      ...Array(20).fill('shipped'),
      ...Array(15).fill('paid'),
      ...Array(12).fill('delivered'),
      ...Array(8).fill('disputed'),
      ...Array(5).fill('refunded'),
      ...Array(10).fill('pending_payment'),
    ];

    let totalGmv = 0;
    let orderCount = 0;
    const orderIds = [];

    for (let i = 0; i < ORDER_STATUSES.length; i++) {
      const status = ORDER_STATUSES[i];
      const listing = listingIds[i % listingIds.length];
      const buyerId = buyerIds[i % buyerIds.length];
      const orderId = uuid();
      const daysAgo = rand(1, 180);
      const createdAt = new Date(Date.now() - daysAgo * 86400000);

      // High-value orders — range from 5L to 80L each
      const quantity = rand(50, 500);
      const unitPrice = listing.price * randFloat(0.6, 0.95, 2); // buying at discount
      const subtotal = Math.round(quantity * unitPrice);
      const commissionRate = randFloat(0.02, 0.05, 3);
      const commission = Math.round(subtotal * commissionRate);
      const gstAmt = Math.round(commission * 0.18);
      const freightAmt = rand(500, 8000);
      const totalAmt = subtotal + freightAmt;

      const orderNumber = `NM${String(Date.now()).slice(-8)}${String(i).padStart(3,'0')}`;

      await client.query(
        `INSERT INTO orders
           (id, order_number, buyer_id, seller_id, listing_id,
            quantity, unit_price, subtotal, platform_commission, commission_rate,
            gst_amount, freight_amount, total_amount,
            status, payment_method, logistics_type, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
`,
        [
          orderId, orderNumber, buyerId, listing.sellerId, listing.id,
          quantity, unitPrice, subtotal, commission, commissionRate,
          gstAmt, freightAmt, totalAmt,
          status,
          'razorpay',
          pick(['platform','seller','buyer']),
          createdAt,
        ]
      );

      // Create escrow for paid/completed/shipped/delivered/disputed
      if (['paid','completed','shipped','delivered','disputed','refunded'].includes(status)) {
        const escrowId = uuid();
        const tcs = Math.round(totalAmt * 0.01);
        const netPayout = totalAmt - commission - gstAmt - tcs;
        const escrowStatus = status === 'completed' ? 'released'
          : status === 'refunded' ? 'refunded'
          : status === 'disputed' ? 'disputed'
          : 'held';

        const escrowCreated = new Date(createdAt.getTime() + rand(10, 60) * 60000);

        await client.query(
          `INSERT INTO escrow_accounts
             (id, order_id, amount, commission, gst_on_commission, tcs_amount,
              net_payout, status, razorpay_payment_id,
              auto_release_at, funded_at, released_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
  `,
          [
            escrowId, orderId, totalAmt, commission, gstAmt, tcs,
            netPayout, escrowStatus,
            'pay_' + Math.random().toString(36).slice(2,18),
            new Date(escrowCreated.getTime() + 7 * 86400000),
            escrowCreated,
            status === 'completed' || status === 'refunded'
              ? new Date(escrowCreated.getTime() + rand(1, 7) * 86400000)
              : null,
            escrowCreated,
          ]
        );

        // Link escrow back to order
        await client.query(
          `UPDATE orders SET escrow_id = $1 WHERE id = $2`,
          [escrowId, orderId]
        );
      }

      if (['completed','shipped','delivered','paid'].includes(status)) {
        totalGmv += totalAmt;
      }
      orderCount++;
      const buyerUserIdForOrder = buyerUserIds[i % buyerUserIds.length];
      orderIds.push({ id: orderId, buyerId, buyerUserId: buyerUserIdForOrder, sellerId: listing.sellerId, status });
    }

    console.log(`  ✓ ${orderCount} orders created`);
    console.log(`  ✓ GMV (completed+active): ₹${(totalGmv/10000000).toFixed(2)} Cr`);

    // ── 5. Create Disputes ───────────────────────────────────
    console.log('\nCreating disputes...');
    const disputedOrders = orderIds.filter(o => o.status === 'disputed');
    const disputeReasons = ['item_not_received','quality_mismatch','quantity_short','damaged_goods','wrong_item','payment_issue'];

    for (const order of disputedOrders) {
      const reason = pick(disputeReasons);
      const createdAt = new Date(Date.now() - rand(1, 30) * 86400000);
      await client.query(
        `INSERT INTO disputes
           (id, order_id, raised_by_user_id, reason, description, status,
            sla_deadline, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$7)
`,
        [
          uuid(), order.id, order.buyerUserId,
          reason,
          `Dispute raised for order. Issue: ${reason.replace(/_/g,' ')}. Buyer has submitted evidence. Awaiting seller response and admin resolution.`,
          new Date(createdAt.getTime() + 72 * 3600000),
          createdAt,
        ]
      );
    }
    console.log(`  ✓ ${disputedOrders.length} disputes created`);

    // ── 6. Update seller GMV totals ──────────────────────────
    await client.query(`
      UPDATE seller_profiles sp
      SET total_gmv = sub.gmv
      FROM (
        SELECT seller_id, SUM(total_amount) AS gmv
        FROM orders
        WHERE status IN ('completed','shipped','delivered')
        GROUP BY seller_id
      ) sub
      WHERE sp.id = sub.seller_id
    `);
    console.log('\n  ✓ Seller GMV totals updated');

    // ── 6b. Seed Notifications ──────────────────────────────
    console.log('\nCreating notifications...');

    // Collect all user IDs (seller users + buyer users)
    const allUserIds = [...sellerUserIds, ...buyerUserIds];

    const NOTIFICATION_TYPES = [
      { type: 'order_placed',       title: 'New Order Received',             body: 'You have a new order #{orderNum}. Review and confirm shipment details.' },
      { type: 'order_completed',    title: 'Order Completed',                body: 'Order #{orderNum} has been completed successfully. Payment will be released shortly.' },
      { type: 'order_shipped',      title: 'Order Shipped',                  body: 'Your order #{orderNum} has been shipped. Track your shipment for delivery updates.' },
      { type: 'payment_received',   title: 'Payment Received',              body: 'Payment of ₹{amount} received for order #{orderNum}. Funds held in escrow.' },
      { type: 'escrow_released',    title: 'Escrow Released',                body: 'Escrow for order #{orderNum} has been released. ₹{amount} credited to your account.' },
      { type: 'dispute_opened',     title: 'Dispute Raised',                body: 'A dispute has been raised on order #{orderNum}. Please respond with evidence within 48 hours.' },
      { type: 'dispute_resolved',   title: 'Dispute Resolved',              body: 'The dispute on order #{orderNum} has been resolved. Check resolution details.' },
      { type: 'kyc_approved',       title: 'KYC Approved',                  body: 'Your KYC verification has been approved. You now have full access to the platform.' },
      { type: 'kyc_reminder',       title: 'KYC Verification Pending',      body: 'Complete your KYC verification to unlock all platform features. Upload your documents now.' },
      { type: 'listing_approved',   title: 'Listing Approved',              body: 'Your listing "{listing}" has been approved and is now live on the marketplace.' },
      { type: 'listing_featured',   title: 'Listing Featured',              body: 'Your listing "{listing}" has been featured on the homepage for increased visibility.' },
      { type: 'price_alert',        title: 'Price Drop Alert',              body: 'A listing you\'re watching has dropped in price. Check it out before stock runs out.' },
      { type: 'welcome',            title: 'Welcome to NirmalMandi',        body: 'Welcome aboard! Complete your profile to start buying and selling dead inventory.' },
      { type: 'platform_update',    title: 'Platform Update',               body: 'We\'ve added new features to improve your experience. Check out what\'s new.' },
      { type: 'commission_update',  title: 'Commission Rate Updated',       body: 'Commission rates have been updated for your sector. Review the new rates in your dashboard.' },
    ];
    const CHANNELS = ['push', 'whatsapp', 'sms', 'email', 'in_app'];
    const STATUSES = ['sent', 'sent', 'sent', 'read', 'read', 'pending', 'failed'];

    let notifCount = 0;
    for (let i = 0; i < 200; i++) {
      const userId = pick(allUserIds);
      const tmpl = pick(NOTIFICATION_TYPES);
      const channel = pick(CHANNELS);
      const status = pick(STATUSES);
      const daysAgo = rand(0, 90);
      const createdAt = new Date(Date.now() - daysAgo * 86400000 - rand(0, 86400000));
      const readAt = status === 'read' ? new Date(createdAt.getTime() + rand(60, 86400) * 1000) : null;

      // Substitute placeholders
      const orderNum = `NM${String(Date.now()).slice(-8)}${String(i).padStart(3,'0')}`;
      const amount = rand(10000, 5000000).toLocaleString('en-IN');
      const listingTitle = pick(['Maruti Alto Spare Parts', 'Cotton Kurta Set', 'Paracetamol Tablets', 'Office Desk Set', 'CNC Lathe Machine', 'Tally ERP License', 'Denim Jeans Export']);
      const body = tmpl.body
        .replace('{orderNum}', orderNum)
        .replace('{amount}', amount)
        .replace('{listing}', listingTitle);

      await client.query(
        `INSERT INTO notifications (id, user_id, type, title, body, channel, status, read_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [uuid(), userId, tmpl.type, tmpl.title, body, channel, status, readAt, createdAt]
      );
      notifCount++;
    }
    console.log(`  ✓ ${notifCount} notifications created`);

    // ── 7. Final summary ────────────────────────────────────
    const [gmvRow] = (await client.query(`SELECT SUM(total_amount) AS gmv FROM orders WHERE status = 'completed'`)).rows;
    const [listCount] = (await client.query(`SELECT COUNT(*) AS n FROM listings WHERE status = 'live'`)).rows;
    const [orderCountRow] = (await client.query(`SELECT COUNT(*) AS n FROM orders`)).rows;
    const [userCountRow] = (await client.query(`SELECT COUNT(*) AS n FROM users`)).rows;
    const [notifCountRow] = (await client.query(`SELECT COUNT(*) AS n FROM notifications`)).rows;
    const [disputeCountRow] = (await client.query(`SELECT COUNT(*) AS n FROM disputes`)).rows;
    const [escrowCountRow] = (await client.query(`SELECT COUNT(*) AS n FROM escrow_accounts`)).rows;

    console.log('\n══════════════════════════════════════════');
    console.log('🌱 SEED COMPLETE');
    console.log('══════════════════════════════════════════');
    console.log(`  Users:          ${userCountRow.n}`);
    console.log(`  Listings:       ${listCount.n} (live)`);
    console.log(`  Orders:         ${orderCountRow.n}`);
    console.log(`  Escrow:         ${escrowCountRow.n}`);
    console.log(`  Disputes:       ${disputeCountRow.n}`);
    console.log(`  Notifications:  ${notifCountRow.n}`);
    console.log(`  GMV (completed): ₹${(parseFloat(gmvRow.gmv || 0) / 10000000).toFixed(2)} Cr`);
    console.log('══════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Seed error:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

seed();
