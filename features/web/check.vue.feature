@domain:primes @seam:component
Feature: The prime checker page

  @scenario:typing-a-composite
  Scenario: Typing a composite shows its factorisation
    Given the prime checker page
    When the visitor types "91"
    Then the page shows "91 = 7 × 13"
