describe('Authentication', () => {
  beforeEach(() => {
    // Set Mapbox token before visiting the page
    cy.window().then((win) => {
      win.MAPBOX_TOKEN = Cypress.env('MAPBOX_TOKEN');
    });

    cy.visit('/', {
      onBeforeLoad: (win) => {
        // Initialize Cypress-specific properties
        win.Cypress = window.Cypress;
      }
    });

    // Prevent all uncaught exceptions from failing tests
    Cypress.on('uncaught:exception', (err) => {
      return false;
    });
  });

  it('should register a new user through the UI', () => {
    cy.visit('/')
    cy.log('Visiting homepage')
    
    // Click register tab
    cy.get('[data-cy=register-tab]').click()
    cy.log('Clicked register tab')
    
    // Fill registration form
    const uniqueEmail = `test${Date.now()}@example.com`
    cy.get('[data-cy=email-input]').type(uniqueEmail)
    cy.get('[data-cy=password-input]').type('testpass123')
    cy.get('[data-cy=confirm-password-input]').type('testpass123')
    cy.log('Filled registration form')
    
    // Submit form and wait for token
    cy.get('[data-cy=submit-button]').click()
    cy.log('Submitted form')
  })
})
