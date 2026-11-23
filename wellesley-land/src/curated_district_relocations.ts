import type {
  VoxelBlueprint,
  WorldCreation,
  WorldPath,
  WorldProp,
  WorldTerrainZone,
  WorldVillager,
} from "./types";
import { ensureSafeCommunityBuildings } from "./safe_community_buildings";
import { ensureSafeCommunityBuildingsBatch2 } from "./safe_community_buildings_batch2";
import { normalizeAndGroundBlueprint } from "./voxel_dsl";

export const QUARRY_BOTANICAL_GARDEN_ID = "c-quarry-botanical-garden";
export const WELLESLEY_TOWER_ID = "c-wellesley-tower";

/**
 * Iconic `"large"` Collegiate Gothic limestone carillon bell tower (inspired by Wellesley's
 * Galen Stone Tower) grounded flush at Y = 0 with zero raised plinth: stepped corner buttresses,
 * Boston ivy climbing accents, pointed Gothic oak portal on +Z, illuminated amber lancet windows,
 * gilded clock dials, open-arched belfry housing a swinging bronze carillon bell, four corner
 * Gothic turret pinnacles, and a slate-and-verdigris spire with spinning golden weathervane.
 */
export function buildWellesleyTowerBlueprint(): VoxelBlueprint {
  return normalizeAndGroundBlueprint(
    {
      name: "Wellesley Tower",
      description:
        "Historic collegiate Gothic stone carillon tower chiming across Wellesley Land and framing the western ring promenade.",
      category: "building",
      scaleClass: "large",
      liveFeed: { kind: "time", place: "Wellesley", timezone: "America/New_York" },
      palette: {
        limestone: "#dfd4be",
        limestoneShade: "#c8bca4",
        stoneTrim: "#eee6d4",
        flagstone: "#aba59a",
        oakDark: "#5e3d24",
        oakDoor: "#754c2e",
        amberGlow: "#ffcb6b",
        stainedBlue: "#5d9bd6",
        stainedAmber: "#f4b94c",
        cream: "#fbf6ea",
        clockHand: "#272d34",
        brass: "#d4a438",
        gold: "#f5c84c",
        bronzeBell: "#b5863d",
        slateRoof: "#434c59",
        slateTrim: "#5d6878",
        verdigris: "#5da68f",
        ivyDeep: "#2f6b36",
        ivyBright: "#478f48",
      },
      ops: [
        // 1. Flush Sanctuary Lower Tower Shaft (Y = 0..15)
        { op: "hollowBox", x0: -7, y0: 0, z0: -7, x1: 7, y1: 15, z1: 7, wall: 1, color: "limestone", trim: "stoneTrim" },
        // Interior sanctuary floor flush at Y = 0..1
        { op: "box", x0: -6, y0: 0, z0: -6, x1: 6, y1: 1, z1: 6, color: "flagstone" },

        // Stepped Gothic Corner Buttresses cleanly outside [-7..7] so zero overlap
        { op: "box", x0: 7, y0: 0, z0: 7, x1: 9, y1: 14, z1: 9, color: "limestoneShade", mirrorX: true },
        { op: "box", x0: 7, y0: 0, z0: -9, x1: 9, y1: 14, z1: -7, color: "limestoneShade", mirrorX: true },
        { op: "box", x0: 5, y0: 0, z0: 7, x1: 7, y1: 10, z1: 9, color: "limestone", mirrorX: true },
        { op: "box", x0: 5, y0: 0, z0: -9, x1: 7, y1: 10, z1: -7, color: "limestone", mirrorX: true },
        { op: "box", x0: 7, y0: 0, z0: 5, x1: 9, y1: 10, z1: 7, color: "limestone", mirrorX: true },
        { op: "box", x0: 7, y0: 0, z0: -7, x1: 9, y1: 10, z1: -5, color: "limestone", mirrorX: true },
        // Sloped stone caps atop buttress piers
        { op: "box", x0: 7, y0: 14, z0: 7, x1: 9, y1: 15, z1: 9, color: "stoneTrim", mirrorX: true },
        { op: "box", x0: 7, y0: 14, z0: -9, x1: 9, y1: 15, z1: -7, color: "stoneTrim", mirrorX: true },

        // Pointed Collegiate Gothic Portal on +Z (Y = 0..10)
        { op: "box", x0: 2, y0: 0, z0: 7, x1: 4, y1: 6, z1: 9, color: "stoneTrim", mirrorX: true },
        { op: "arch", cx: 0, y0: 6, cz: 7, halfSpan: 3, height: 5, depth: 2, axis: "z", color: "stoneTrim" },
        // Clear doorway recess at z = 6..7 and insert recessed oak portal + warm amber lancet transom
        { op: "clear", x0: -2, y0: 0, z0: 6, x1: 2, y1: 7, z1: 7 },
        { op: "box", x0: -2, y0: 0, z0: 5, x1: 2, y1: 5, z1: 6, color: "oakDoor" },
        { op: "box", x0: -2, y0: 5, z0: 5, x1: 2, y1: 7, z1: 6, color: "amberGlow", emit: 1.0 },
        // Flush flagstone entry threshold step at Y = 0..1
        { op: "box", x0: -2, y0: 0, z0: 7, x1: 2, y1: 1, z1: 10, color: "flagstone" },

        // Lower string-course belt cornice (Y = 15..16)
        { op: "box", x0: -7, y0: 15, z0: -7, x1: 7, y1: 16, z1: 7, color: "stoneTrim" },

        // 2. Middle Stone Shaft & Stained-Glass Lancet Windows (Y = 16..34)
        { op: "hollowBox", x0: -6, y0: 16, z0: -6, x1: 6, y1: 34, z1: 6, wall: 1, color: "limestone", trim: "stoneTrim" },
        // Upper corner buttress pilasters (Y = 16..34)
        { op: "box", x0: 5, y0: 16, z0: 6, x1: 6, y1: 34, z1: 7, color: "limestoneShade", mirrorX: true },
        { op: "box", x0: 5, y0: 16, z0: -7, x1: 6, y1: 34, z1: -6, color: "limestoneShade", mirrorX: true },
        { op: "box", x0: 6, y0: 16, z0: 5, x1: 7, y1: 34, z1: 6, color: "limestoneShade", mirrorX: true },
        { op: "box", x0: 6, y0: 16, z0: -6, x1: 7, y1: 34, z1: -5, color: "limestoneShade", mirrorX: true },

        // Glowing stained-glass Gothic lancet windows recessed on all 4 facades (Y = 18..26)
        { op: "clear", x0: -2, y0: 18, z0: 5, x1: 2, y1: 26, z1: 6 },
        { op: "box", x0: -2, y0: 18, z0: 4, x1: 2, y1: 24, z1: 5, color: "stainedAmber", emit: 0.9 },
        { op: "box", x0: -1, y0: 24, z0: 4, x1: 1, y1: 26, z1: 5, color: "stainedBlue", emit: 0.9 },

        { op: "clear", x0: -2, y0: 18, z0: -6, x1: 2, y1: 26, z1: -5 },
        { op: "box", x0: -2, y0: 18, z0: -5, x1: 2, y1: 24, z1: -4, color: "stainedAmber", emit: 0.9 },
        { op: "box", x0: -1, y0: 24, z0: -5, x1: 1, y1: 26, z1: -4, color: "stainedBlue", emit: 0.9 },

        { op: "clear", x0: 5, y0: 18, z0: -2, x1: 6, y1: 26, z1: 2 },
        { op: "box", x0: 4, y0: 18, z0: -2, x1: 5, y1: 24, z1: 2, color: "stainedAmber", emit: 0.9 },
        { op: "box", x0: 4, y0: 24, z0: -1, x1: 5, y1: 26, z1: 1, color: "stainedBlue", emit: 0.9 },

        { op: "clear", x0: -6, y0: 18, z0: -2, x1: -5, y1: 26, z1: 2 },
        { op: "box", x0: -5, y0: 18, z0: -2, x1: -4, y1: 24, z1: 2, color: "stainedAmber", emit: 0.9 },
        { op: "box", x0: -5, y0: 24, z0: -1, x1: -4, y1: 26, z1: 1, color: "stainedBlue", emit: 0.9 },

        // Illuminated Clock Dials on +Z and -Z faces (Y = 28..33)
        { op: "clear", x0: -2, y0: 28, z0: 5, x1: 2, y1: 33, z1: 6 },
        { op: "box", x0: -2, y0: 28, z0: 4, x1: 2, y1: 33, z1: 5, color: "cream", emit: 0.55 },
        { op: "ring", axis: "z", cx: 0, cy: 30.5, z0: 6, z1: 7, outerR: 2.8, innerR: 2.0, color: "brass" },
        { op: "clear", x0: -2, y0: 28, z0: -6, x1: 2, y1: 33, z1: -5 },
        { op: "box", x0: -2, y0: 28, z0: -5, x1: 2, y1: 33, z1: -4, color: "cream", emit: 0.55 },
        { op: "ring", axis: "z", cx: 0, cy: 30.5, z0: -7, z1: -6, outerR: 2.8, innerR: 2.0, color: "brass" },

        // Clock hands & Boston ivy climbing tendrils on lower stonework
        {
          op: "voxels",
          list: [
            // Front & back clock hands
            [0, 31, 5, "clockHand"],
            [0, 32, 5, "clockHand"],
            [1, 30, 5, "clockHand"],
            [0, 31, -5, "clockHand"],
            [0, 32, -5, "clockHand"],
            [-1, 30, -5, "clockHand"],
            // Climbing Boston ivy on +Z / +X lower stonework (outside solid wall at z=7 / x=7)
            [5, 1, 7, "ivyDeep"],
            [5, 2, 7, "ivyDeep"],
            [4, 2, 7, "ivyBright"],
            [5, 3, 7, "ivyBright"],
            [5, 4, 7, "ivyDeep"],
            [4, 4, 7, "ivyDeep"],
            [5, 5, 7, "ivyBright"],
            [-5, 1, 7, "ivyDeep"],
            [-5, 2, 7, "ivyBright"],
            [-4, 3, 7, "ivyDeep"],
            [-5, 4, 7, "ivyBright"],
            [7, 1, 3, "ivyDeep"],
            [7, 2, 3, "ivyBright"],
            [7, 3, 2, "ivyDeep"],
            [7, 4, 3, "ivyBright"],
            [-7, 1, -3, "ivyDeep"],
            [-7, 2, -2, "ivyBright"],
            [-7, 3, -3, "ivyDeep"],
          ],
        },

        // Belfry gallery cornice (Y = 34..35)
        { op: "box", x0: -7, y0: 34, z0: -7, x1: 7, y1: 35, z1: 7, color: "stoneTrim" },

        // 3. Open-Arched Carillon Belfry (Y = 35..44)
        // Four sturdy corner Gothic piers framing open belfry arches
        { op: "box", x0: 4, y0: 35, z0: 4, x1: 6, y1: 44, z1: 6, color: "limestone", mirrorX: true },
        { op: "box", x0: 4, y0: 35, z0: -6, x1: 6, y1: 44, z1: -4, color: "limestone", mirrorX: true },
        // Four Gothic arches spanning the upper belfry openings
        { op: "arch", cx: 0, y0: 40, cz: 4, halfSpan: 4, height: 4, depth: 2, axis: "z", color: "stoneTrim" },
        { op: "arch", cx: 0, y0: 40, cz: -6, halfSpan: 4, height: 4, depth: 2, axis: "z", color: "stoneTrim" },
        { op: "arch", cx: 4, y0: 40, cz: 0, halfSpan: 4, height: 4, depth: 2, axis: "x", color: "stoneTrim" },
        { op: "arch", cx: -6, y0: 40, cz: 0, halfSpan: 4, height: 4, depth: 2, axis: "x", color: "stoneTrim" },

        // Belfry ceiling & parapet deck (Y = 44..45)
        { op: "box", x0: -6, y0: 44, z0: -6, x1: 6, y1: 45, z1: 6, color: "stoneTrim" },

        // Four Corner Gothic Turret Pinnacles (Y = 45..52)
        { op: "box", x0: 4, y0: 45, z0: 4, x1: 6, y1: 48, z1: 6, color: "stoneTrim", mirrorX: true },
        { op: "cone", cx: 5, y0: 48, y1: 52, cz: 5, rBottom: 1.3, rTop: 0.4, color: "verdigris", mirrorX: true },
        { op: "box", x0: 4, y0: 45, z0: -6, x1: 6, y1: 48, z1: -4, color: "stoneTrim", mirrorX: true },
        { op: "cone", cx: 5, y0: 48, y1: 52, cz: -5, rBottom: 1.3, rTop: 0.4, color: "verdigris", mirrorX: true },

        // 4. Central Slate-and-Verdigris Lantern Spire (Y = 45..57)
        { op: "cone", cx: 0, y0: 45, y1: 55, cz: 0, rBottom: 4.4, rTop: 0.8, color: "slateRoof" },
        { op: "cylinder", axis: "y", cx: 0, y0: 55, y1: 57, cz: 0, radius: 0.7, color: "verdigris" },
      ],
      parts: [
        {
          name: "carillon-bell",
          kind: "swingZ",
          speed: 1.35,
          amp: 0.26,
          phase: 0,
          pivot: [0, 42, 0],
          ops: [
            // Hanging bronze carillon bell strictly inside open belfry void (clear of piers & ceiling)
            { op: "cylinder", axis: "y", cx: 0, y0: -2, y1: 0, cz: 0, radius: 0.6, color: "oakDark" },
            { op: "cone", cx: 0, y0: -5, y1: -2, cz: 0, rBottom: 1.9, rTop: 1.0, color: "bronzeBell" },
            { op: "box", x0: 0, y0: -6, z0: 0, x1: 1, y1: -5, z1: 1, color: "gold" },
          ],
        },
        {
          name: "spire-weathervane",
          kind: "spinY",
          speed: 0.55,
          pivot: [0, 58, 0],
          ops: [
            // Spinning golden Gothic finial weathervane 1 full voxel clear above spire finial (y1: 57)
            { op: "cylinder", axis: "y", cx: 0, y0: 0, y1: 3, cz: 0, radius: 0.5, color: "gold" },
            { op: "box", x0: -2, y0: 2, z0: 0, x1: 3, y1: 3, z1: 1, color: "gold" },
            { op: "box", x0: 2, y0: 1, z0: 0, x1: 3, y1: 4, z1: 1, color: "brass" },
          ],
        },
      ],
    },
    "Wellesley Tower",
  );
}


/**
 * Lush `"large"` landscaped botanical rose, waterlily, and cherry-blossom garden pavilion
 * grounded flush at Y = 0 with a central Victorian wrought-iron glasshouse gazebo,
 * tiered turquoise marble fountain, four symmetrical floral parterre beds, arched rose
 * trellises on all four approaches, sculpted topiaries, and blooming cherry trees.
 */
export function buildQuarryBotanicalGardenBlueprint(): VoxelBlueprint {
  return normalizeAndGroundBlueprint(
    {
      name: "Quarryside Botanical Garden",
      description:
        "Landscaped botanical rose, waterlily, and cherry-blossom garden oasis beside the northeast quarry and power plant.",
      category: "building",
      scaleClass: "large",
      palette: {
        gravelCream: "#ece3cf",
        stoneTrim: "#d6ccb8",
        stoneWarm: "#bcae97",
        turfRich: "#4ba347",
        hedgeDark: "#2d6f32",
        hedgeBright: "#3f8d42",
        soilDark: "#5e432c",
        ironWhite: "#f5f7f8",
        glassAqua: "#bcecf5",
        marblePool: "#2a9dad",
        waterBright: "#6ce3ec",
        foam: "#f2fdff",
        rosePink: "#ec658e",
        roseCrimson: "#d13b5c",
        lavender: "#9b72dc",
        sunGold: "#f6c844",
        hydrangea: "#63b4f2",
        blossomPale: "#ffd4e5",
        blossomMid: "#f598bc",
        woodWarm: "#8b5a34",
        lanternGold: "#ffe38e",
        brass: "#d4a438",
      },
      ops: [
        // 1. Flush garden terrace lawn & limestone perimeter curb at Y = 0..1 (zero floating slab!)
        { op: "roundedBox", x0: -18, y0: 0, z0: -18, x1: 18, y1: 1, z1: 18, radius: 3.0, color: "turfRich" },
        // Cruciform gravel garden promenades along X = 0 and Z = 0
        { op: "box", x0: -3, y0: 0, z0: -18, x1: 3, y1: 1, z1: 18, color: "gravelCream" },
        { op: "box", x0: -18, y0: 0, z0: -3, x1: 18, y1: 1, z1: 3, color: "gravelCream" },
        { op: "cylinder", axis: "y", cx: 0, y0: 0, y1: 1, cz: 0, radius: 8.4, color: "gravelCream" },

        // Low sculpted perimeter hedge walls with four wide gateway openings
        { op: "box", x0: -17, y0: 1, z0: -18, x1: -5, y1: 3, z1: -16, color: "hedgeDark", mirrorX: true },
        { op: "box", x0: -17, y0: 1, z0: 16, x1: -5, y1: 3, z1: 18, color: "hedgeDark", mirrorX: true },
        { op: "box", x0: -18, y0: 1, z0: -16, x1: -16, y1: 3, z1: -5, color: "hedgeDark", mirrorX: true },
        { op: "box", x0: -18, y0: 1, z0: 5, x1: -16, y1: 3, z1: 16, color: "hedgeDark", mirrorX: true },

        // 2. Four limestone-edged parterre flowerbeds brimming with roses, lavender, sunflowers & hydrangeas
        // NW & NE parterres (z = -14..-6)
        { op: "roundedBox", x0: 6, y0: 1, z0: -14, x1: 14, y1: 2, z1: -6, radius: 1.2, color: "stoneTrim", mirrorX: true },
        { op: "box", x0: 7, y0: 2, z0: -13, x1: 13, y1: 3, z1: -7, color: "soilDark", mirrorX: true },
        { op: "box", x0: 7, y0: 3, z0: -13, x1: 10, y1: 4, z1: -10, color: "rosePink", mirrorX: true },
        { op: "box", x0: 10, y0: 3, z0: -13, x1: 13, y1: 4, z1: -10, color: "sunGold", mirrorX: true },
        { op: "box", x0: 7, y0: 3, z0: -10, x1: 10, y1: 4, z1: -7, color: "lavender", mirrorX: true },
        { op: "box", x0: 10, y0: 3, z0: -10, x1: 13, y1: 4, z1: -7, color: "hydrangea", mirrorX: true },

        // SW & SE parterres (z = +6..+14)
        { op: "roundedBox", x0: 6, y0: 1, z0: 6, x1: 14, y1: 2, z1: 14, radius: 1.2, color: "stoneTrim", mirrorX: true },
        { op: "box", x0: 7, y0: 2, z0: 7, x1: 13, y1: 3, z1: 13, color: "soilDark", mirrorX: true },
        { op: "box", x0: 7, y0: 3, z0: 7, x1: 10, y1: 4, z1: 10, color: "roseCrimson", mirrorX: true },
        { op: "box", x0: 10, y0: 3, z0: 7, x1: 13, y1: 4, z1: 10, color: "lavender", mirrorX: true },
        { op: "box", x0: 7, y0: 3, z0: 10, x1: 10, y1: 4, z1: 13, color: "sunGold", mirrorX: true },
        { op: "box", x0: 10, y0: 3, z0: 10, x1: 13, y1: 4, z1: 13, color: "rosePink", mirrorX: true },

        // Sculpted emerald topiary spheres anchoring parterre inner corners
        { op: "cylinder", axis: "y", cx: 6, y0: 1, y1: 3, cz: 6, radius: 0.9, color: "woodWarm", mirrorX: true },
        { op: "sphere", cx: 6, cy: 4.5, cz: 6, rx: 1.8, ry: 2.0, rz: 1.8, color: "hedgeBright", mirrorX: true },
        { op: "cylinder", axis: "y", cx: 6, y0: 1, y1: 3, cz: -6, radius: 0.9, color: "woodWarm", mirrorX: true },
        { op: "sphere", cx: 6, cy: 4.5, cz: -6, rx: 1.8, ry: 2.0, rz: 1.8, color: "hedgeBright", mirrorX: true },

        // 3. Central Victorian Glasshouse Gazebo & Tiered Waterlily Fountain
        // Outer white-iron pavilion columns (8 octagonal-feel posts around radius ~6.2)
        { op: "cylinder", axis: "y", cx: 4.5, y0: 1, y1: 11, cz: 4.5, radius: 0.8, color: "ironWhite", mirrorX: true },
        { op: "cylinder", axis: "y", cx: 4.5, y0: 1, y1: 11, cz: -4.5, radius: 0.8, color: "ironWhite", mirrorX: true },
        { op: "cylinder", axis: "y", cx: 6.2, y0: 1, y1: 11, cz: 0, radius: 0.8, color: "ironWhite", mirrorX: true },
        { op: "cylinder", axis: "y", cx: 0, y0: 1, y1: 11, cz: 6.2, radius: 0.8, color: "ironWhite" },
        { op: "cylinder", axis: "y", cx: 0, y0: 1, y1: 11, cz: -6.2, radius: 0.8, color: "ironWhite" },
        // Ornate ring cornice & translucent botanical glass dome overhead (Y = 11..19)
        { op: "ring", axis: "y", cx: 0, y0: 11, y1: 13, cz: 0, outerR: 6.8, innerR: 5.4, color: "ironWhite" },
        { op: "dome", cx: 0, yBase: 12, cz: 0, radius: 6.0, color: "glassAqua", emit: 0.25 },
        { op: "ring", axis: "y", cx: 0, y0: 15, y1: 16, cz: 0, outerR: 4.9, innerR: 4.0, color: "ironWhite" },
        { op: "cylinder", axis: "y", cx: 0, y0: 18, y1: 21, cz: 0, radius: 0.9, color: "brass" },

        // Central turquoise waterlily fountain basin at Y = 1..5
        { op: "ring", axis: "y", cx: 0, y0: 1, y1: 3, cz: 0, outerR: 3.8, innerR: 2.8, color: "stoneTrim" },
        { op: "cylinder", axis: "y", cx: 0, y0: 1, y1: 2, cz: 0, radius: 2.9, color: "marblePool", emit: 0.35 },
        { op: "cylinder", axis: "y", cx: 0, y0: 2, y1: 5, cz: 0, radius: 0.9, color: "stoneTrim" },
        { op: "cylinder", axis: "y", cx: 0, y0: 5, y1: 6, cz: 0, radius: 1.8, color: "waterBright", emit: 0.55 },

        // 4. Four Arched Rose Trellises framing the N/S/E/W entrances (+Z main entrance arch)
        { op: "arch", cx: 0, y0: 1, cz: 16, halfSpan: 3, height: 7, depth: 2, axis: "z", color: "ironWhite" },
        { op: "arch", cx: 0, y0: 1, cz: -16, halfSpan: 3, height: 7, depth: 2, axis: "z", color: "ironWhite" },
        { op: "arch", cx: 16, y0: 1, cz: 0, halfSpan: 3, height: 7, depth: 2, axis: "x", color: "ironWhite" },
        { op: "arch", cx: -16, y0: 1, cz: 0, halfSpan: 3, height: 7, depth: 2, axis: "x", color: "ironWhite" },
        // Climbing rose garlands crowning each archway
        { op: "sphere", cx: 0, cy: 8.5, cz: 16, rx: 3.2, ry: 1.3, rz: 1.5, color: "rosePink" },
        { op: "sphere", cx: 0, cy: 8.5, cz: -16, rx: 3.2, ry: 1.3, rz: 1.5, color: "rosePink" },
        { op: "sphere", cx: 16, cy: 8.5, cz: 0, rx: 1.5, ry: 1.3, rz: 3.2, color: "blossomMid" },
        { op: "sphere", cx: -16, cy: 8.5, cz: 0, rx: 1.5, ry: 1.3, rz: 3.2, color: "blossomMid" },

        // 5. Four Flowering Cherry-Blossom Trees at the outer corners
        { op: "cylinder", axis: "y", cx: 14, y0: 1, y1: 7, cz: 14, radius: 1.0, color: "woodWarm", mirrorX: true },
        { op: "sphere", cx: 14, cy: 9, cz: 14, rx: 3.6, ry: 2.8, rz: 3.6, color: "blossomPale", mirrorX: true },
        { op: "sphere", cx: 13, cy: 10.5, cz: 13, rx: 2.4, ry: 1.8, rz: 2.4, color: "blossomMid", mirrorX: true },

        { op: "cylinder", axis: "y", cx: 14, y0: 1, y1: 7, cz: -14, radius: 1.0, color: "woodWarm", mirrorX: true },
        { op: "sphere", cx: 14, cy: 9, cz: -14, rx: 3.6, ry: 2.8, rz: 3.6, color: "blossomPale", mirrorX: true },
        { op: "sphere", cx: 13, cy: 10.5, cz: -13, rx: 2.4, ry: 1.8, rz: 2.4, color: "blossomMid", mirrorX: true },

        // 6. Warm Brass Garden Lanterns & Cedar Benches along the central plaza
        { op: "box", x0: 4, y0: 1, z0: 9, x1: 5, y1: 5, z1: 10, color: "brass", mirrorX: true },
        { op: "box", x0: 4, y0: 5, z0: 9, x1: 5, y1: 6, z1: 10, color: "lanternGold", emit: 1.15, mirrorX: true },
        { op: "box", x0: 4, y0: 1, z0: -10, x1: 5, y1: 5, z1: -9, color: "brass", mirrorX: true },
        { op: "box", x0: 4, y0: 5, z0: -10, x1: 5, y1: 6, z1: -9, color: "lanternGold", emit: 1.15, mirrorX: true },
        { op: "box", x0: 9, y0: 1, z0: 4, x1: 12, y1: 2, z1: 5, color: "woodWarm", mirrorX: true },
        { op: "box", x0: 9, y0: 1, z0: -5, x1: 12, y1: 2, z1: -4, color: "woodWarm", mirrorX: true },
      ],
      parts: [
        {
          // Suspended cleanly in open air between fountain tier (y=6) and dome ceiling (y=12) with zero contact!
          name: "fountain-crystal-spray",
          kind: "bob",
          speed: 2.1,
          amp: 0.35,
          phase: 0,
          pivot: [0, 8.2, 0],
          ops: [
            { op: "sphere", cx: 0, cy: 0, cz: 0, rx: 1.1, ry: 1.4, rz: 1.1, color: "foam", emit: 0.85 },
          ],
        },
      ],
    },
    "Quarryside Botanical Garden",
  );
}

/**
 * Applies the user-curated landmark relocations and Quarryside Botanical Garden area
 * idempotently across seed & persisted world snapshots:
 * 1. Moves Sydney Terrace Row (`c-mvssze4o-1191dc`) next to Animorphosis Transformation Shop (`c-mvr5pfn3-74d357`).
 * 2. Moves Springfield Nuclear Power Plant (`c-mvqyc53g-60ace9`) near Borealis Mineral Quarry (`c-mvnc7tlr-6784e6`)
 *    and creates a lush landscaped botanical garden area beside them.
 * 3. Moves Emerald Cliff Waterfall (`c-mvn0lbb4-74136e`) to where the Nuclear Power Plant was previously,
 *    pushed out to the northwest ocean shoreline (`[-114, -114]`).
 */
export function applyCuratedDistrictRelocations(state: {
  creations: WorldCreation[];
  paths: WorldPath[];
  props: WorldProp[];
  terrainZones: WorldTerrainZone[];
  villagers: WorldVillager[];
}): boolean {
  let changed = false;

  const upsertPath = (nextPath: WorldPath) => {
    const idx = state.paths.findIndex((p) => p.id === nextPath.id);
    if (idx >= 0) {
      if (JSON.stringify(state.paths[idx]) !== JSON.stringify(nextPath)) {
        state.paths[idx] = nextPath;
        changed = true;
      }
    } else {
      state.paths.push(nextPath);
      changed = true;
    }
  };

  const upsertProp = (nextProp: WorldProp) => {
    const idx = state.props.findIndex((pr) => pr.id === nextProp.id);
    if (idx >= 0) {
      if (JSON.stringify(state.props[idx]) !== JSON.stringify(nextProp)) {
        state.props[idx] = nextProp;
        changed = true;
      }
    } else {
      state.props.push(nextProp);
      changed = true;
    }
  };

  const upsertZone = (nextZone: WorldTerrainZone) => {
    const idx = state.terrainZones.findIndex((z) => z.id === nextZone.id);
    if (idx >= 0) {
      if (JSON.stringify(state.terrainZones[idx]) !== JSON.stringify(nextZone)) {
        state.terrainZones[idx] = nextZone;
        changed = true;
      }
    } else {
      state.terrainZones.push(nextZone);
      changed = true;
    }
  };

  // -------------------------------------------------------------------------
  // 1. Move Sydney Terrace Row (`c-mvssze4o-1191dc`) next to Animorphosis (`[-48.2, -3.4]`)
  // -------------------------------------------------------------------------
  const sydneyTerrace = state.creations.find((c) => c.id === "c-mvssze4o-1191dc");
  if (sydneyTerrace) {
    const targetX = -61.6;
    const targetZ = -3.2;
    const targetYaw = -3.142;
    const targetDesc =
      "Historic inner-city terrace homes next to the Animorphosis shop along the western lane.";
    const targetStatus =
      "Heritage terrace homes next to the Animorphosis shop on the western lane";
    if (
      Math.hypot(sydneyTerrace.x - targetX, sydneyTerrace.z - targetZ) > 0.2 ||
      Math.abs((sydneyTerrace.yaw ?? 0) - targetYaw) > 0.05 ||
      sydneyTerrace.description !== targetDesc
    ) {
      sydneyTerrace.x = targetX;
      sydneyTerrace.z = targetZ;
      sydneyTerrace.yaw = targetYaw;
      sydneyTerrace.description = targetDesc;
      if (sydneyTerrace.blueprint) {
        sydneyTerrace.blueprint.description = targetDesc;
      }
      if (sydneyTerrace.behavior?.type === "landmark") {
        sydneyTerrace.behavior = {
          ...sydneyTerrace.behavior,
          facingYaw: targetYaw,
          statusLine: targetStatus,
        };
      }
      changed = true;
    }
    upsertPath({
      id: "spur-c-mvssze4o-1191dc",
      kind: "cobblestone",
      points: [
        [-61.6, -6.2],
        [-61.6, -9.2],
      ],
    });
  }

  // -------------------------------------------------------------------------
  // 2. Move Springfield Nuclear Power Plant (`c-mvqyc53g-60ace9`) near Borealis Quarry (`[118, -114]`)
  //    + Create Lush Quarryside Botanical Garden Area
  // -------------------------------------------------------------------------
  const nuclearPlant = state.creations.find((c) => c.id === "c-mvqyc53g-60ace9");
  if (nuclearPlant) {
    const targetX = 92.0;
    const targetZ = -124.0;
    const targetYaw = 0;
    const targetDesc =
      "Primary municipal nuclear power facility generating electric energy beside the northeast quarry and botanical gardens.";
    const targetStatus =
      "Municipal nuclear power plant beside the northeast quarry and gardens";
    if (
      Math.hypot(nuclearPlant.x - targetX, nuclearPlant.z - targetZ) > 0.2 ||
      nuclearPlant.description !== targetDesc
    ) {
      nuclearPlant.x = targetX;
      nuclearPlant.z = targetZ;
      nuclearPlant.yaw = targetYaw;
      nuclearPlant.description = targetDesc;
      if (nuclearPlant.blueprint) {
        nuclearPlant.blueprint.description = targetDesc;
      }
      if (nuclearPlant.behavior?.type === "landmark") {
        nuclearPlant.behavior = {
          ...nuclearPlant.behavior,
          facingYaw: targetYaw,
          statusLine: targetStatus,
        };
      }
      changed = true;
    }
    upsertPath({
      id: "spur-c-mvqyc53g-60ace9",
      kind: "cobblestone",
      points: [
        [92.0, -113.2],
        [99.5, -104.5],
        [114.2, -98.8],
      ],
    });

    // Keep northern perimeter wanderer clear of the relocated Power Plant & Botanical Garden
    const fusionTitan = state.creations.find((c) => c.id === "c-mw9tr0at-5785ad");
    if (
      fusionTitan &&
      fusionTitan.behavior?.type === "wander" &&
      Math.hypot(fusionTitan.x - targetX, fusionTitan.z - targetZ) < 22
    ) {
      fusionTitan.x = 66.0;
      fusionTitan.z = -128.0;
      fusionTitan.behavior = {
        ...fusionTitan.behavior,
        homeX: 66.0,
        homeZ: -128.0,
        targets: [
          [66.0, -128.0],
          [44.0, -124.0],
          [32.0, -114.0],
          [54.0, -138.0],
        ],
      };
      changed = true;
    }
  }

  // Ensure Quarryside Botanical Garden creation exists right beside the Quarry & Power Plant
  let quarryGarden = state.creations.find((c) => c.id === QUARRY_BOTANICAL_GARDEN_ID);
  if (!quarryGarden) {
    const bp = buildQuarryBotanicalGardenBlueprint();
    quarryGarden = {
      id: QUARRY_BOTANICAL_GARDEN_ID,
      name: bp.name,
      description: bp.description,
      creatorPrompt: "A lush landscaped botanical garden with rose beds, cherry blossoms, and a Victorian gazebo fountain",
      category: "building",
      scaleClass: "large",
      x: 100.0,
      z: -94.0,
      yaw: 1.571,
      blueprint: bp,
      behavior: {
        type: "landmark",
        facingYaw: 1.571,
        activity: "sparkling its waterlily fountain amid blooming rose parterres and cherry trees",
        statusLine: "Botanical rose and waterlily garden oasis beside the quarry and power plant",
      },
      integratedLevel: 2,
      createdAt: 1794433500000,
      isSeed: false,
    };
    state.creations.push(quarryGarden);
    changed = true;
  } else if (Math.hypot(quarryGarden.x - 100.0, quarryGarden.z - -94.0) > 0.2) {
    quarryGarden.x = 100.0;
    quarryGarden.z = -94.0;
    changed = true;
  }

  upsertPath({
    id: `spur-${QUARRY_BOTANICAL_GARDEN_ID}`,
    kind: "cobblestone",
    points: [
      [107.5, -94.0],
      [113.8, -94.0],
    ],
  });

  // Remove old NW desert sand zone (`zone-f647a04f` under flying UFO) so NW waterfall coast is mossy green
  // and total terrainZones stays well within the 28-zone shader budget.
  const staleDesertIdx = state.terrainZones.findIndex((z) => z.id === "zone-f647a04f");
  if (staleDesertIdx >= 0) {
    state.terrainZones.splice(staleDesertIdx, 1);
    changed = true;
  }

  upsertZone({
    id: "zone-quarry-garden",
    biome: "meadow_clover",
    x: 98.0,
    z: -99.0,
    radius: 19,
  });

  // Scenic lily pond, flower patches, blossom tree clusters, benches, lamps & signpost for the garden area
  upsertProp({
    id: "prop-quarry-garden-pond",
    kind: "pond",
    x: 89.5,
    z: -105.0,
    yaw: 0,
    radius: 4.0,
  });
  upsertProp({
    id: "prop-quarry-garden-flowers-1",
    kind: "flower_patch",
    x: 108.5,
    z: -103.0,
    yaw: 0.4,
    radius: 3.2,
  });
  upsertProp({
    id: "prop-quarry-garden-flowers-2",
    kind: "flower_patch",
    x: 91.5,
    z: -86.5,
    yaw: 1.8,
    radius: 3.2,
  });
  upsertProp({
    id: "prop-quarry-garden-trees-1",
    kind: "tree_cluster",
    x: 82.5,
    z: -112.0,
    yaw: 0.9,
    radius: 3.5,
  });
  upsertProp({
    id: "prop-quarry-garden-trees-2",
    kind: "tree_cluster",
    x: 105.5,
    z: -125.0,
    yaw: 2.2,
    radius: 3.5,
  });
  upsertProp({
    id: "prop-quarry-garden-bench-1",
    kind: "bench",
    x: 95.2,
    z: -104.5,
    yaw: -1.571,
    label: "Lily Pond Garden Bench",
  });
  upsertProp({
    id: "prop-quarry-garden-bench-2",
    kind: "bench",
    x: 107.2,
    z: -90.5,
    yaw: 1.571,
    label: "Quarryside Rose Garden Bench",
  });
  upsertProp({
    id: "prop-quarry-garden-lamp-1",
    kind: "lamp_post",
    x: 107.8,
    z: -96.2,
    yaw: 0,
  });
  upsertProp({
    id: "prop-quarry-garden-sign",
    kind: "signpost",
    x: 111.8,
    z: -91.5,
    yaw: 1.571,
    label: "Quarryside Botanical Garden",
  });

  if (!state.villagers.some((v) => v.id === "villager-flora-quarry")) {
    state.villagers.push({
      id: "villager-flora-quarry",
      name: "Flora",
      role: "gardener",
      hatColor: "#f6c844",
      shirtColor: "#ec658e",
      homeX: 107.5,
      homeZ: -94.0,
      stops: [
        [107.5, -94.0],
        [95.2, -104.5],
        [99.5, -86.5],
      ],
      usesTransit: false,
    });
    changed = true;
  }

  // -------------------------------------------------------------------------
  // 3. Move Emerald Cliff Waterfall (`c-mvn0lbb4-74136e`) to where the Nuclear Power Plant was
  //    previously (`[-78.2, -94.7]` radial), except right near the northwest ocean water (`[-114, -114]`)
  // -------------------------------------------------------------------------
  const waterfall = state.creations.find((c) => c.id === "c-mvn0lbb4-74136e");
  if (waterfall) {
    const targetX = -114.0;
    const targetZ = -114.0;
    const targetYaw = 0.7854; // Facing SE (+X, +Z) inland from the NW coastal cliff edge
    const targetDesc =
      "Northwest coastal waterfall cascading beside the ocean shore and feeding fresh mountain water into the island's streams.";
    const targetStatus =
      "Coastal waterfall cascading beside the northwest ocean shore";
    if (
      Math.hypot(waterfall.x - targetX, waterfall.z - targetZ) > 0.2 ||
      Math.abs((waterfall.yaw ?? 0) - targetYaw) > 0.05 ||
      waterfall.description !== targetDesc
    ) {
      waterfall.x = targetX;
      waterfall.z = targetZ;
      waterfall.yaw = targetYaw;
      waterfall.description = targetDesc;
      if (waterfall.blueprint) {
        waterfall.blueprint.description = targetDesc;
      }
      if (waterfall.behavior?.type === "landmark") {
        waterfall.behavior = {
          ...waterfall.behavior,
          facingYaw: targetYaw,
          statusLine: targetStatus,
        };
      }
      changed = true;
    }

    upsertZone({
      id: "zone-waterfall-lagoon",
      biome: "misty_moss",
      x: -112.0,
      z: -112.0,
      radius: 21,
    });

    // Keep Secret Bunker Entrance (`c-mvvof1qs-c35822` at `[-90.4, -149.3]`) connected to `path-outer-ring`
    if (state.creations.some((c) => c.id === "c-mvvof1qs-c35822")) {
      upsertPath({
        id: "spur-c-mvvof1qs-c35822",
        kind: "cottage_road",
        points: [
          [-88.9, -145.3],
          [-68.9, -145.3],
          [-68.9, -92.0],
          [-46.7, -80.4],
          [-42.5, -82.4],
        ],
      });
    }

    // Scenic NW coastal boardwalk leading out past the former power-plant meadow to the Waterfall lagoon
    upsertPath({
      id: "spur-c-mvn0lbb4-74136e",
      kind: "boardwalk",
      points: [
        [-102.0, -102.0],
        [-84.0, -78.0],
        [-80.4, -46.8],
      ],
    });

    upsertProp({
      id: "prop-nw-waterfall-bench",
      kind: "bench",
      x: -99.5,
      z: -104.5,
      yaw: -2.356,
      label: "Coastal Waterfall Overlook",
    });

    // Ensure Tropical Palm Grove (`c-mwafobip-90526d`) in the south connects cleanly to `path-outer-ring`
    // now that the waterfall moved from `[-14, 91]` to the NW coast
    if (state.creations.some((c) => c.id === "c-mwafobip-90526d")) {
      upsertPath({
        id: "spur-c-mwafobip-90526d",
        kind: "boardwalk",
        points: [
          [15.8, 118.3],
          [12.8, 65.5],
        ],
      });
    }
  }

  if (ensureSafeCommunityBuildings({ creations: state.creations, paths: state.paths })) {
    changed = true;
  }

  if (ensureSafeCommunityBuildingsBatch2({ creations: state.creations, paths: state.paths })) {
    changed = true;
  }

  // -------------------------------------------------------------------------
  // 5. Ensure Wellesley Tower (`c-wellesley-tower`) stands prominently along the west ring road
  // -------------------------------------------------------------------------
  let wellesleyTower = state.creations.find((c) => c.id === WELLESLEY_TOWER_ID);
  const towerX = -62.0;
  const towerZ = 36.0;
  const towerYaw = -0.785;
  if (!wellesleyTower) {
    const bp = buildWellesleyTowerBlueprint();
    wellesleyTower = {
      id: WELLESLEY_TOWER_ID,
      name: bp.name,
      description: bp.description,
      creatorPrompt:
        "Collegiate Gothic limestone Wellesley Tower with a swinging bronze carillon bell, illuminated clock dials, and a copper-tipped slate spire",
      category: "building",
      scaleClass: "large",
      x: towerX,
      z: towerZ,
      yaw: towerYaw,
      blueprint: bp,
      liveFeed: bp.liveFeed,
      behavior: {
        type: "landmark",
        facingYaw: towerYaw,
        activity: "ringing its carillon chimes across Wellesley Land",
        statusLine: "Historic collegiate Gothic carillon tower along the western ring promenade",
      },
      integratedLevel: 2,
      createdAt: 1794436000000,
      isSeed: false,
    };
    state.creations.push(wellesleyTower);
    changed = true;
  }

  upsertPath({
    id: `spur-${WELLESLEY_TOWER_ID}`,
    kind: "cobblestone",
    points: [
      [-65.4, 38.6],
      [-66.7, 39.5],
    ],
  });

  upsertProp({
    id: "prop-wellesley-tower-bench",
    kind: "bench",
    x: -57.2,
    z: 38.8,
    yaw: 0.72,
    label: "Wellesley Tower Green",
  });

  upsertProp({
    id: "prop-wellesley-tower-lamp",
    kind: "lamp_post",
    x: -66.2,
    z: 34.4,
    yaw: 0,
    label: "Wellesley Tower Lantern",
  });

  return changed;
}
