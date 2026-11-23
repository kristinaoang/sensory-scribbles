// Names and blurbs for the polished voxel island. Meshes stay in the Gemini Island
// style; the places a visitor reads are Wellesley College.

type Identity = { name: string; description: string };

const RULES: Array<{ test: RegExp } & Identity> = [
  { test: /wellesley tower|clocktower|clock tower|carillon/i, name: "Galen Stone Tower", description: "The collegiate Gothic carillon above the academic quad." },
  { test: /library|bookshop|book club|archive|bindery/i, name: "Clapp Library", description: "The college library, with steps opening onto the quad." },
  { test: /chapel|church/i, name: "Houghton Memorial Chapel", description: "The chapel at the head of the green." },
  { test: /observatory|planetarium|astrolabe|orrery/i, name: "Whitin Observatory", description: "The observatory dome on the edge of campus." },
  { test: /museum|gallery|aquarium/i, name: "Davis Museum", description: "The campus museum, just off the arts walk." },
  { test: /botanical|garden|greenhouse|orangerie|conservatory|arboretum/i, name: "Hunnewell Arboretum", description: "Trees and garden rooms beside the lake path." },
  { test: /boathouse|kayak|maritime|harbor/i, name: "Lake Waban Boathouse", description: "Shells and canoes waiting on the Waban shore." },
  { test: /waterfall|lake|pond|reef|ocean|cove/i, name: "Lake Waban", description: "The college lake, bright at the foot of the hill." },
  { test: /mallard|duck|swan|whale/i, name: "Waban Heron", description: "A lake bird keeping to the quiet shore." },
  { test: /pub|taqueria|ramen|cafe|espresso|gelato|gelateria|bakery|creamery|candy|burger|pancake|noodle/i, name: "Collins Cafe", description: "A warm campus stop between classes." },
  { test: /school bus|shuttle|tram|train/i, name: "Blue Shuttle", description: "The campus shuttle looping the college roads." },
  { test: /firehouse|pumper|safety depot|lifeguard|lifesaving/i, name: "Campus Safety", description: "The college safety house by the north drive." },
  { test: /court|pickleball|padel|hoop|halfpipe|skate|playground|agility|pool pavilion|aquatic/i, name: "Keohane Sports Center", description: "Courts and fields on the athletic side of campus." },
  { test: /mansion|manor|hotel|pavilion|apartments|cottage|lodge/i, name: "Tower Court", description: "A residence hall looking back toward the tower." },
  { test: /science|labyrinth|datacentre|data centre|foundry|rocket|coil tower/i, name: "Science Center", description: "Labs and classrooms around the science courtyard." },
  { test: /music|symphony|jazz|vinyl|cbgs|cbgb|piano|sequencer/i, name: "Jewett Arts Center", description: "Studios and a stage for the arts." },
  { test: /post office|mail/i, name: "Campus Post Office", description: "The mail window beside the campus center." },
  { test: /hospital|health/i, name: "Health Service", description: "The college health service on a quiet lane." },
  { test: /cinema|cineplex/i, name: "Collins Cinema", description: "The campus cinema, lights low in the afternoon." },
];

const POOL: Identity[] = [
  ["Green Hall", "Classrooms and offices on the academic quad."],
  ["Founders Hall", "An old college hall facing the central path."],
  ["Billings Hall", "Stone walls and tall windows on the green."],
  ["Pendleton Hall", "Art studios with north light."],
  ["Pendleton West", "The west wing of the arts buildings."],
  ["Sage Hall", "A hall along the residence ridge."],
  ["Alumnae Hall", "The ballroom and stage used for college gatherings."],
  ["Severance Hall", "A green-facing hall with a deep porch."],
  ["Stone Hall", "A residence house on the lake side."],
  ["Claflin Hall", "A dormitory along the east path."],
  ["Beebe Hall", "Windows looking toward the chapel lawn."],
  ["Cazenove Hall", "A residence hall under the oaks."],
  ["Pomeroy Hall", "A smaller house just off the quad."],
  ["Munger Hall", "A brick house on the walking loop."],
  ["Shafer Hall", "A dormitory beside the garden gate."],
  ["Freeman Hall", "A college house with a sunny stair."],
  ["McAfee Hall", "Rooms above the path to the lake."],
  ["Bates Hall", "A hall near the dining green."],
  ["Stone-Davis Hall", "A residence pair sharing one courtyard."],
  ["Tower Court East", "The east wing beneath the tower."],
  ["Tower Court West", "The west wing, close to the carillon."],
  ["Lulu Chow Wang Campus Center", "The campus center, where paths cross."],
  ["The Bookstore", "Course books and a window on the walk."],
  ["El Table", "A student kitchen and late table."],
  ["The Pub", "A low campus room for supper."],
  ["Admission Gate", "The first gate visitors walk through."],
  ["Academic Quad", "The open lawn between the halls."],
  ["Chapel Lawn", "Grass in front of the chapel steps."],
  ["Library Steps", "The wide steps up to the library."],
  ["Science Courtyard", "A courtyard ringed by lab wings."],
  ["Global Flora", "The greenhouse walk in the botanic garden."],
  ["The Edible Ecosystem", "Garden beds used by the college."],
  ["Shakespeare House", "A small house used for readings."],
  ["Whitin Lawn", "The lawn under the observatory dome."],
  ["Davis Courtyard", "The museum court, quiet at midday."],
  ["Cinema Lobby", "Posters and a carpet before the lights go down."],
  ["The Blue Bike Rack", "Bikes lined up outside the campus center."],
  ["Grounds Barn", "Mowers and rakes for the college lawns."],
  ["The Power House", "The old utilities house, now part of the walk."],
  ["Distribution Center", "Packages waiting behind the mail room."],
  ["The Chapel Porch", "A covered stop before the chapel doors."],
  ["The Carillon Stairs", "Stairs winding up toward the bells."],
  ["Founders Steps", "Stone steps worn smooth by the quad."],
  ["The North Gate", "A gate onto the college from the north road."],
  ["The South Gate", "The lake-side gate."],
  ["Waban Shore Path", "A footpath following the water."],
  ["The Oak Path", "Oaks shading the walk between halls."],
  ["The Willow", "A willow at the turn of the lake."],
  ["Crew Dock", "The dock where the shells go out."],
  ["Sailing Shed", "Small boats stored above the shore."],
  ["The Hockey Rink", "The rink beside the sports center."],
  ["The Track", "Lanes around the athletic field."],
  ["Tennis Courts", "Courts behind a green fence."],
  ["The Soccer Pitch", "An open field past the last hall."],
  ["Lacrosse Field", "Grass marked for a college game."],
  ["The Field House", "An indoor field on wet days."],
  ["The Climbing Wall", "A wall inside the sports center."],
  ["The Dance Studio", "A sprung floor and a mirror."],
  ["The Black Box", "A small theater with the seats close."],
  ["Practice Rooms", "Music rooms along a quiet corridor."],
  ["WZLY", "The college radio room."],
  ["The News Office", "Desks for the college paper."],
  ["Choir Room", "Folders and a piano under the chapel."],
  ["The Greenhouse", "Glass rooms of college plants."],
  ["The Japanese Garden", "A still corner of the arboretum."],
  ["The Sundial", "A sundial in the middle of the quad."],
  ["The Flagpole", "The flagpole on the main lawn."],
  ["Quad Elm", "The elm everyone walks under."],
  ["The Stone Bench", "A bench facing the tower."],
  ["Outdoor Classroom", "A ring of seats under the trees."],
  ["The Art Ramp", "The ramp up to the studios."],
  ["The Science Bridge", "A bridge between two lab wings."],
  ["Residence Ridge", "Houses stepping down toward the lake."],
  ["The Lake House", "A small house with a view of Waban."],
  ["Pine Grove", "Pines between the sports fields and the road."],
  ["The Chapel Organ", "The organ loft above the chapel nave."],
  ["Admission Garden", "Flowers by the admission door."],
  ["The Motor Court", "Where the shuttle turns around."],
  ["Campus Van", "A college van parked in the shade."],
  ["Mail Cart", "The cart that carries campus mail."],
  ["Grounds Cart", "A cart of rakes for the lawns."],
  ["Racing Shell", "A long shell resting by the dock."],
  ["Lake Canoe", "A canoe pulled up on the grass."],
  ["Quad Squirrel", "A squirrel on the academic lawn."],
  ["Chapel Robin", "A robin on the chapel hedge."],
  ["Library Cat", "The cat that naps in a library window."],
  ["Tower Owl", "An owl that keeps to the tower at dusk."],
  ["Path Chipmunk", "A chipmunk on the oak path."],
  ["Garden Bee", "Bees in the arboretum beds."],
  ["Shore Turtle", "A turtle on a Waban log."],
  ["The Blue Shuttle Stop", "The sign where the shuttle pauses."],
  ["East Residence Path", "The path that ties the dorms together."],
  ["West Residence Path", "The path behind Tower Court."],
  ["Arts Walk", "The walk from the museum to the studios."],
  ["Science Walk", "The walk from the quad to the labs."],
  ["Chapel Walk", "The straight walk to the chapel."],
  ["Lake Stairs", "Stairs down from the hill to the water."],
  ["The Bell Lawn", "Lawn directly under the carillon."],
  ["Green Hall Steps", "Steps at the door of Green Hall."],
  ["Pendleton Steps", "Steps shared by the art buildings."],
  ["Museum Ramp", "The ramp into the Davis Museum."],
  ["Cafe Terrace", "Outdoor tables at Collins Cafe."],
  ["The Dining Green", "The lawn outside the dining hall."],
  ["Bates Dining", "The dining room in Bates."],
  ["Tower Dining", "A dining room near Tower Court."],
  ["The Bookstore Window", "A display of college sweaters."],
  ["The Radio Antenna", "A small antenna above WZLY."],
  ["The Scoreboard", "The scoreboard at the near field."],
  ["The Boathouse Ramp", "The ramp that lowers a shell to the lake."],
  ["Arboretum Gate", "The wooden gate into the arboretum."],
  ["Global Flora Dome", "The planted dome in the botanic garden."],
  ["The Night Path", "Lamps along the path back to the halls."],
  ["The Morning Gate", "The gate that catches the first sun."],
].map(([name, description]) => ({ name, description }));

export function assignWellesleyIdentity(
  id: string,
  rawName: string,
  _category: string,
  used: Set<string>,
): Identity {
  const cleaned = String(rawName || "").replace(/^journally\s*[:·—–-]+\s*/i, "");
  for (const rule of RULES) {
    if (rule.test.test(cleaned) && !used.has(rule.name)) {
      used.add(rule.name);
      return { name: rule.name, description: rule.description };
    }
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  for (let i = 0; i < POOL.length; i++) {
    const item = POOL[(hash + i) % POOL.length];
    if (!used.has(item.name)) {
      used.add(item.name);
      return item;
    }
  }
  const name = `Campus Lawn ${used.size + 1}`;
  used.add(name);
  return { name, description: "A sunny spot on the Wellesley College grounds." };
}
