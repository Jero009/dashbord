describe('My First Test', () => {
  it('Visits the app root url', () => {
    cy.visit('/')
    cy.contains('h1', 'Readiness')
    cy.contains('h2', 'How it drains')
  })
})
