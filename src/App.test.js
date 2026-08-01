import { render, screen } from '@testing-library/react';

jest.mock('tone', () => ({}));

import App from './App';

test('renders island store landing', () => {
  render(<App />);
  expect(screen.getByText(/choose your path/i)).toBeInTheDocument();
  expect(screen.getByText(/play the game/i)).toBeInTheDocument();
});
