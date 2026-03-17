import '../src/globals.css';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

export const decorators = [
  (Story) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
          <Story />
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  ),
];

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
  a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } },
};