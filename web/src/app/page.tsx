'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowRight, TrendingDown, Package, Layers, ChevronRight } from 'lucide-react';
import Header from '@/components/Header';
import ListingCard from '@/components/ListingCard';
import { inventoryApi, type Listing, type Sector } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: featuredData } = useQuery({
    queryKey: ['listings', 'featured'],
    queryFn: () => inventoryApi.getListings({ featured: true, limit: 8 }),
    // API returns { success, data: { rows: [...], total } }
    select: (res) => (res.data as unknown as { data: { rows: Listing[] } })?.data ?? null,
  });

  const { data: sectorsData } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => inventoryApi.getSectors(),
    // API returns { success, data: [...sectors] }
    select: (res) => (res.data as unknown as { data: Sector[] })?.data ?? [],
  });

  const listings: Listing[] = (featuredData?.rows ?? []) as Listing[];
  const sectors: Sector[] = Array.isArray(sectorsData) ? sectorsData : [];

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/listings?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/listings');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <TrendingDown className="w-4 h-4" />
            B2B Liquidation Marketplace
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
            India&apos;s B2B Dead Inventory<br />
            <span className="text-yellow-300">Marketplace</span>
          </h1>
          <p className="text-lg text-primary-100 mb-10 max-w-2xl mx-auto">
            Buy surplus, dead, and liquidation inventory at up to 80% off. Connect directly with verified sellers across India.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search electronics, apparel, FMCG..."
                className="w-full pl-10 pr-4 py-3 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-lg"
              />
            </div>
            <button type="submit" className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-semibold px-5 py-3 rounded-xl transition-colors shadow-lg flex items-center gap-2">
              Search
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-6 mt-12 text-sm">
            {[
              { label: 'Active Listings', value: '500+' },
              { label: 'Verified Sellers', value: '120+' },
              { label: 'Sectors', value: '25+' },
              { label: 'States Covered', value: '28' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 rounded-xl px-6 py-3 text-center">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-primary-200 text-xs mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-accent-600 text-white py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p className="font-medium">Have dead inventory to liquidate?</p>
          <div className="flex gap-3">
            <Link
              href="/listings"
              className="bg-white text-accent-700 font-semibold px-4 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
            >
              Browse Deals
            </Link>
            <Link
              href="/login"
              className="bg-accent-700 text-white font-semibold px-4 py-1.5 rounded-lg hover:bg-accent-800 transition-colors border border-white/20"
            >
              List Your Inventory
            </Link>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 space-y-14">

        {/* Sector browse */}
        <section id="sectors">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Browse by Sector</h2>
              <p className="text-gray-500 text-sm mt-1">Find deals in your industry</p>
            </div>
            <Link href="/listings" className="text-sm text-primary-600 font-medium flex items-center gap-1 hover:gap-2 transition-all">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {sectors.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {sectors.map((sector) => (
                <Link
                  key={sector.id}
                  href={`/listings?sector=${encodeURIComponent(sector.slug)}`}
                  className="card p-4 text-center hover:shadow-md hover:border-primary-200 transition-all group"
                >
                  <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-primary-100 transition-colors">
                    <Layers className="w-5 h-5 text-primary-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition-colors">
                    {sector.name}
                  </p>
                  {sector.listing_count !== undefined && (
                    <p className="text-xs text-gray-400 mt-0.5">{sector.listing_count} listings</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-xl mx-auto mb-2" />
                  <div className="h-3 bg-gray-200 rounded mx-auto w-3/4" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Featured listings */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Featured Deals</h2>
              <p className="text-gray-500 text-sm mt-1">Handpicked inventory at the best prices</p>
            </div>
            <Link href="/listings" className="text-sm text-primary-600 font-medium flex items-center gap-1 hover:gap-2 transition-all">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-40 bg-gray-200 rounded-t-xl" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Browse Inventory',
                desc: 'Search and filter thousands of dead stock listings across India by sector, price, and location.',
                icon: Search,
              },
              {
                step: '02',
                title: 'Place Your Order',
                desc: 'Register as a buyer, select quantity, and place an order directly with the seller.',
                icon: Package,
              },
              {
                step: '03',
                title: 'Save Big',
                desc: 'Get verified inventory at 50–80% below market price. GST invoices provided.',
                icon: TrendingDown,
              },
            ].map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                  {step}
                </div>
                <div className="mb-2">
                  <Icon className="w-5 h-5 text-primary-600 mx-auto mb-1" />
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 px-4 mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p className="font-semibold text-gray-800">
            Nirmal<span className="text-primary-600">Mandi</span>
          </p>
          <p>&copy; {new Date().getFullYear()} NirmalMandi. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/listings" className="hover:text-primary-600 transition-colors">Browse</Link>
            <Link href="/login" className="hover:text-primary-600 transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
