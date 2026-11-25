@domain:primes @seam:node
Feature: Checking numbers and finding the next prime

  The capabilities run in a Node session over the compiled crate, through the same catalog every adapter serves.

  Background:
    Given a session over the compiled crate

  @scenario:prime
  Scenario: A prime is its own smallest factor
    When the session checks 97
    Then the answer is prime
    And its smallest factor is 97

  @scenario:composite
  Scenario: A composite answers its smallest factor
    When the session checks 91
    Then the answer is composite
    And its smallest factor is 7

  @scenario:next-prime
  Scenario: The next prime is the smallest prime above a number
    When the session asks for the next prime after 97
    Then the next prime is 101

  @scenario:check-out-of-range
  Scenario: A number below two is out of range
    When the session checks 1
    Then the call is refused as out of range from 2 to 9007199254740991
