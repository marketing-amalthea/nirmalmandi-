'use client';

import './globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <html lang="en" className="dark">
      <head>
        <title>Amalthea Command Center | NirmalMandi</title>
        <meta name="description" content="NirmalMandi Admin Panel" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              duration: 4000,
              classNames: {
                toast: 'font-sans text-sm',
              },
            }}
          />
        </QueryClientProvider>
      </body>
    </html>
  );
}
