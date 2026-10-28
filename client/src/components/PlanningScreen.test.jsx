/**
 * @fileoverview Unit test for PlanningScreen.jsx — purely presentational,
 * no props, no state.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlanningScreen } from './PlanningScreen.jsx';

describe('PlanningScreen', () => {
  it('shows a loading message', () => {
    render(<PlanningScreen />);
    expect(screen.getByText(/building your lesson plan/i)).toBeInTheDocument();
  });
});
