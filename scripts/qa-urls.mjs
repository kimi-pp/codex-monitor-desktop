const baseUrl = "http://127.0.0.1:5173/";

const targets = [
  {
    name: "Facility seat interaction mixed",
    query: "debugPaused=1&debugFlatAnchors=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:idle,Cascade:idle,Delta:working,Echo:thinking,Forge:offline&debugIdleBehaviors=Aurora:pantry,Binary:pantry,Cascade:restroom"
  },
  {
    name: "Pantry two-seat idle",
    query: "debugPaused=1&debugFlatAnchors=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:idle,Cascade:working,Delta:working,Echo:thinking,Forge:offline&debugIdleBehaviors=Aurora:pantry,Binary:pantry"
  },
  {
    name: "Restroom toilet idle",
    query: "debugPaused=1&debugFlatAnchors=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:working,Cascade:thinking,Delta:working,Echo:working,Forge:offline&debugIdleBehaviors=Aurora:restroom"
  },
  {
    name: "Treadmill run idle",
    query: "debugPaused=1&debugFlatAnchors=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:working,Cascade:thinking,Delta:working,Echo:working,Forge:offline&debugIdleBehaviors=Aurora:treadmill"
  },
  {
    name: "Treadmill capacity idle",
    query: "debugPaused=1&debugFlatAnchors=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:idle,Cascade:working,Delta:working,Echo:thinking,Forge:offline&debugIdleBehaviors=Aurora:treadmill,Binary:treadmill"
  },
  {
    name: "Walking pantry departure",
    query: "debugPaused=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:working,Cascade:thinking,Delta:working,Echo:working,Forge:offline&debugIdleBehaviors=Aurora:pantry"
  },
  {
    name: "Walking restroom departure",
    query: "debugPaused=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:working,Cascade:thinking,Delta:working,Echo:working,Forge:offline&debugIdleBehaviors=Aurora:restroom"
  },
  {
    name: "Walking treadmill departure",
    query: "debugPaused=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:working,Cascade:thinking,Delta:working,Echo:working,Forge:offline&debugIdleBehaviors=Aurora:treadmill"
  },
  {
    name: "Mixed multi-agent walking",
    query: "debugPaused=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:idle,Cascade:idle,Delta:working,Echo:thinking,Forge:offline&debugIdleBehaviors=Aurora:pantry,Binary:restroom,Cascade:treadmill"
  },
  {
    name: "Mixed state baseline",
    query: "debugPaused=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:working,Cascade:thinking,Delta:blocked,Echo:error,Forge:offline"
  },
  {
    name: "Idle capacity and away screens",
    query: "debugPaused=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:idle,Cascade:idle,Delta:idle,Echo:working,Forge:offline"
  },
  {
    name: "All workstations occupied",
    query: "debugPaused=1&debugLayoutMetrics=1&debugAgents=Aurora:working,Binary:working,Cascade:working,Delta:working,Echo:working,Forge:offline"
  }
];

const viewports = [
  "1920x1080",
  "2560x1440",
  "3840x2160"
];

console.log("Renderer QA targets");
console.log("");
targets.forEach((target) => {
  console.log(`${target.name}:`);
  console.log(`${baseUrl}?${target.query}`);
  console.log("");
});
console.log(`Viewport checks: ${viewports.join(", ")}`);
