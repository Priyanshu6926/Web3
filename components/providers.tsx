'use client';
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '@/lib/wagmi';
import { useState } from 'react';
export function Providers({ children }: { children: React.ReactNode }) { const [client] = useState(() => new QueryClient()); return <WagmiProvider config={config}><QueryClientProvider client={client}><RainbowKitProvider theme={darkTheme({ accentColor:'#b6f36b', accentColorForeground:'#14200d', borderRadius:'large', overlayBlur:'small' })}>{children}</RainbowKitProvider></QueryClientProvider></WagmiProvider>; }
