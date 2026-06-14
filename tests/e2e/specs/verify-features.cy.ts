// Temporary verification spec for the 6 new feature phases.
// SQLite is a no-op on web, so these confirm the pages mount, route, and the
// new controls render/react without runtime errors (empty-state path).

describe('New features render without runtime errors', () => {
  it('Analytics → Overview (insights + recovery)', () => {
    cy.visit('/analytics');
    cy.contains('Today').should('be.visible');
    cy.contains('Training load').should('be.visible');
    cy.contains('Insights').should('be.visible');
    cy.screenshot('01-analytics-overview');
  });

  it('Analytics → Gym (volume/tonnage/heatmap)', () => {
    cy.visit('/analytics/gym');
    cy.contains('Training load').should('be.visible');
    cy.contains('Volume by muscle group').should('be.visible');
    cy.contains('Training frequency').should('be.visible');
    cy.screenshot('02-analytics-gym');
  });

  it('Analytics → Review (week/month toggle)', () => {
    cy.visit('/analytics/review');
    cy.contains('Training & health').should('be.visible');
    cy.contains('Habits & goals').should('be.visible');
    cy.contains('Net worth change').should('exist');
    // Toggle to month (Ionic segment button — force past the shadow-DOM wrapper).
    cy.contains('ion-segment-button', 'This month').click({ force: true });
    cy.contains('Spent vs budget').should('exist');
    cy.screenshot('03-analytics-review');
  });

  it('Finance → Analytics (donut/budget/trend)', () => {
    cy.visit('/finance/analytics');
    cy.contains('Spending by category').should('be.visible');
    cy.contains('Budget vs actual').should('be.visible');
    cy.contains('Income vs spending').should('be.visible');
    cy.screenshot('04-finance-analytics');
  });

  it('Body page shows measurement inputs + metric selector', () => {
    cy.visit('/health/body');
    cy.contains('Waist (cm)').should('be.visible');
    cy.contains('Chest (cm)').should('be.visible');
    cy.contains('Body fat (%)').should('be.visible');
    cy.screenshot('05-body-measurements');
  });

  it('Goals page link picker reveals exercise/account selects', () => {
    cy.visit('/plan/goals');
    // Open the add-goal form (toggle button).
    cy.get('button.icon-btn').first().click();
    cy.get('select.form-select').should('exist');
    // Choosing "lift_pr" should reveal the exercise picker select.
    cy.get('select.form-select').first().select('lift_pr');
    cy.get('select.form-select').should('have.length.at.least', 2);
    cy.contains('Progress updates automatically').should('be.visible');
    cy.screenshot('06-goal-link-picker');
  });

  it('Settings shows morning summary + weekly digest rows', () => {
    cy.visit('/settings');
    cy.contains('Morning summary').scrollIntoView().should('be.visible');
    cy.contains('Weekly digest').scrollIntoView().should('be.visible');
    cy.screenshot('07-settings-notifications');
  });

  it('HomePage mounts with This Week / recovery sections', () => {
    cy.visit('/home');
    cy.contains('Battery').should('be.visible');
    cy.screenshot('08-home');
  });
});
