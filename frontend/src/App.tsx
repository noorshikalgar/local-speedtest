import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnitProvider } from './contexts/unit';
import { ThemeProvider } from './contexts/theme';
import { Dashboard } from './pages/Dashboard';
import { SettingsPage } from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

export default function App() {
  return (
    <ThemeProvider>
      <UnitProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </UnitProvider>
    </ThemeProvider>
  );
}
