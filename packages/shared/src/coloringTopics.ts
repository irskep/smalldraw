/** Lightweight topic metadata shared by routes, SEO, and the artwork catalog. */
export const COLORING_TOPICS = [
  {
    id: "animals",
    title: "Animals",
    heading: "Animal coloring pages",
    description:
      "Free animal coloring pages to color online. Choose cats, dogs, birds, and more. No ads, no gimmicks.",
  },
  {
    id: "dinosaurs",
    title: "Dinosaurs",
    heading: "Dinosaur coloring pages",
    description:
      "Free dinosaur coloring pages to color online in Splatterboard. Pick a prehistoric picture and start coloring.",
  },
  {
    id: "insects",
    title: "Butterflies & bugs",
    heading: "Butterfly and bug coloring pages",
    description:
      "Free butterfly and bug coloring pages to color online. Pick a picture and make it your own in Splatterboard.",
  },
  {
    id: "underwater",
    title: "Underwater",
    heading: "Underwater coloring pages",
    description:
      "Free underwater coloring pages to color online. Explore sea creatures and ocean pictures in Splatterboard.",
  },
  {
    id: "magic",
    title: "Magic & fairy tales",
    heading: "Fairy tale coloring pages",
    description:
      "Free fairy tale coloring pages to color online. Choose a magical picture in Splatterboard’s coloring book.",
  },
  {
    id: "nature",
    title: "Flowers & nature",
    heading: "Flower and nature coloring pages",
    description:
      "Free flower and nature coloring pages to color online. Pick a picture from the natural world and start coloring.",
  },
  {
    id: "food",
    title: "Food",
    heading: "Food coloring pages",
    description:
      "Free food coloring pages to color online in Splatterboard. Choose a picture and fill it with your favorite colors.",
  },
  {
    id: "letters",
    title: "Letters & numbers",
    heading: "Letter and number coloring pages",
    description:
      "Free letter and number coloring pages to color online. Browse complete alphabets and numbers in Splatterboard.",
  },
  {
    id: "holidays",
    title: "Holidays",
    heading: "Holiday coloring pages",
    description:
      "Free holiday coloring pages to color online. Find seasonal pictures to color in Splatterboard.",
  },
  {
    id: "patterns",
    title: "Shapes & patterns",
    heading: "Shape and pattern coloring pages",
    description:
      "Free shape and pattern coloring pages to color online. Choose geometric patterns, mandalas, and more in Splatterboard.",
  },
  {
    id: "art",
    title: "Art & scenes",
    heading: "Art and scene coloring pages",
    description:
      "Free art and scene coloring pages to color online. Explore pictures and illustrations in Splatterboard’s coloring book.",
  },
  {
    id: "public-domain-review",
    title: "Public Domain Review",
    heading: "Public Domain Review Coloring Book",
    description:
      "Color pictures from the Public Domain Review Coloring Book online for free in Splatterboard. No ads, no gimmicks.",
  },
] as const;

export function getColoringTopic(pathname: string) {
  const path = pathname.replace(/\/+$/, "");
  return COLORING_TOPICS.find((topic) => path === `/coloringbook/${topic.id}`);
}
