@domain:acidcat @seam:adapters
Feature: Each adapter serves exactly the leaves its target declares

  One catalog feeds every adapter. A capability reaches a target only when its own audience names it, so the check history
  belongs to the page and the command line, and the Worker's tool surfaces never see it.

  @scenario:web-registers-every-leaf
  Scenario: WebMCP registers every leaf the page declares
    Given a web session
    When the WebMCP adapter registers its tools
    Then the listing is "primes.check, primes.history.clear, primes.history.list, primes.next"

  @scenario:cli-lists-its-leaves
  Scenario: The command line lists the leaves the cli target declares
    Given a cli session
    When the command line lists its capabilities
    Then the listing is "primes.check, primes.history.clear, primes.history.list, primes.next"

  @scenario:mcp-lists-its-leaves
  Scenario: The MCP endpoint lists the leaves the mcp target declares
    Given an mcp session
    When an MCP client lists the tools
    Then the listing is "primes.check, primes.next"

  @scenario:rpc-lists-its-leaves
  Scenario: The capnweb API serves the leaves the rpc target declares
    Given an rpc session
    When a capnweb client asks the API for its capabilities
    Then the listing is "primes.check, primes.next"

  @scenario:mcp-refuses-history-by-name
  Scenario: The MCP endpoint refuses a history leaf called by name
    Given an mcp session
    When an MCP client calls "primes.history.clear"
    Then the call is refused as an unknown tool named "primes.history.clear"
