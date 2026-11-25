@domain:acidcat @seam:adapters
Feature: A capability reaches only the targets its audience names

  One catalog feeds every adapter. The check history belongs to the page and the command line, so the Worker's MCP
  endpoint never lists it.

  @scenario:cli-lists-its-leaves
  Scenario: The command line lists the history
    Given a cli session
    When the command line lists its capabilities
    Then the listing is "primes.check, primes.history.clear, primes.history.list, primes.next"

  @scenario:mcp-lists-its-leaves
  Scenario: The MCP endpoint leaves the history out
    Given an mcp session
    When an MCP client lists the tools
    Then the listing is "primes.check, primes.next"
