
const normalize = (text = "") =>
  text
    .toUpperCase()
    .replace(/[.,!?;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function identifyRobot(text) {
  // Check Robot 2 first, including spaced and natural-language variants.
  if (
    /\b(R\s*2|ROBOT\s*(?:2|02|TWO|SECOND)|SECOND ROBOT|ROBOT NUMBER TWO|THE SECOND ONE)\b/.test(text)
  ) {
    return "R2";
  }

  if (
    /\b(R\s*1|ROBOT\s*(?:1|01|ONE|FIRST)|FIRST ROBOT|ROBOT NUMBER ONE|THE FIRST ONE)\b/.test(text)
  ) {
    return "R1";
  }

  return null;
}

function identifyDestination(text) {
  if (/\b(CHARG(?:E|ING|ER)|RECHARGE|RECHARGING|CHARGING BAY|CHARGING STATION)\b/.test(text)) {
    return "CHARGING";
  }

  if (/\b(PICKUP|PICK UP|PICKUP ZONE)\b/.test(text)) {
    return "PICKUP";
  }

  if (/\b(PACKING|PACKAGING|PAKAGING|PACKING ZONE|PACKAGING ZONE)\b/.test(text)) {
    return "PACKING";
  }

  if (/\b(DISPATCH|SHIPPING|DISPATCH BAY|DISPATCH SECTION)\b/.test(text)) {
    return "DISPATCH";
  }

  const rack = text.match(/\bRACK\s*([A-H]|[1-8])\b/);

  if (rack) {
    const value = rack[1];
    const letter = /^[1-8]$/
      .test(value)
      ? String.fromCharCode("A".charCodeAt(0) + Number(value) - 1)
      : value;

    return `RACK ${letter}`;
  }

  if (/\bROBOT BAY\b/.test(text)) {
    return "ROBOT BAY";
  }

  if (/\bHOME\b/.test(text)) {
    const robot = identifyRobot(text);
    return robot === "R2" ? "HOME R2" : "HOME R1";
  }

  return null;
}

export function interpretCommand(input) {
  const text = normalize(input);
  const robot = identifyRobot(text);

  if (!text) {
    return { intent: "UNKNOWN", text };
  }

  if (/^(HELP|WHAT CAN YOU DO|SHOW COMMANDS)$/.test(text)) {
    return { intent: "HELP" };
  }

  if (
    /\b(STATUS|BATTERY|BATTERY LEVEL|PROGRESS|POSITION|WHERE IS|WHERE S)\b/.test(text) ||
    /\b(HOW MUCH BATTERY|WHAT IS THE BATTERY|TELL ME THE STATUS)\b/.test(text) ||
    /\b(WHAT ARE|WHAT IS|TELL ME).*\b(DOING|STATUS|BATTERY)\b/.test(text)
  ) {
    const allRobots =
      /\b(BOTH|ALL|BOTH ROBOTS|ROBOTS|EVERY ROBOT)\b/.test(text) && !robot;

    return {
      intent: "STATUS",
      robot: allRobots ? "ALL" : robot || "R1",
    };
  }

  if (/\b(RESET|RESTART)\b.*\b(SIMULATION|WAREHOUSE|EVERYTHING)\b/.test(text)) {
    return { intent: "RESET" };
  }

  if (/\b(REPLAN|RECALCULATE|FIND A NEW ROUTE)\b/.test(text)) {
    return { intent: "REPLAN" };
  }

  if (/\b(CLEAR|EMPTY)\b.*\b(QUEUE|TASK QUEUE)\b/.test(text)) {
    return { intent: "QUEUE_CLEAR" };
  }

  if (/\b(RUN|START|PROCESS)\b.*\b(QUEUE|NEXT TASK)\b/.test(text)) {
    return { intent: "RUN_QUEUE" };
  }

  if (/\b(PAUSE|STOP|HALT|HOLD)\b/.test(text)) {
    const allRobots =
      /\b(BOTH|ALL|BOTH ROBOTS|EVERY ROBOT)\b/.test(text) && !robot;

    return {
      intent: "PAUSE",
      robot: allRobots ? "ALL" : robot || "ALL",
    };
  }

  if (/\b(RESUME|CONTINUE|START MOVING|GET GOING|LET .* CONTINUE)\b/.test(text)) {
    return { intent: "RESUME", robot: robot || "R1" };
  }

  if (/\b(WORKFLOW|FULL WORKFLOW|COMPLETE WORKFLOW)\b/.test(text)) {
    return { intent: "WORKFLOW", robot: robot || "R1" };
  }

  const destination = identifyDestination(text);

  if (destination) {
    // Never silently send an ambiguous movement command to Robot 1.
    if (!robot) {
      return {
        intent: "NEEDS_CLARIFICATION",
        destination,
        text,
      };
    }

    return {
      intent: "MOVE",
      robot,
      destination,
    };
  }

  return { intent: "UNKNOWN", text };
}
