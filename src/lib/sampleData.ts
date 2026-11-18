import type { FoundItem, ItemCategory } from '../types';
import { validateAndPreprocessImage } from './imageProcessor';
import { indexFoundItemFromProcessed } from './matcher';

interface SampleItemSpec {
  imagePath: string;
  filename: string;
  category: ItemCategory;
  description: string;
  locationFound: string;
  dateFound: string;
}

const SAMPLE_ITEMS: SampleItemSpec[] = [
  {
    imagePath: '/src/assets/images/sample_bottle_star_1794977278348.jpg',
    filename: 'sample_bottle_star.jpg',
    category: 'bottle',
    description: 'Matte black stainless steel insulated bottle with a metallic gold star sticker on the side.',
    locationFound: 'Main Library, 2nd Floor Study Table',
    dateFound: '2026-11-14',
  },
  {
    imagePath: '/src/assets/images/sample_bottle_plain_1794977279021.jpg',
    filename: 'sample_bottle_plain.jpg',
    category: 'bottle',
    description: 'Matte black insulated water bottle with white TERRA logo and small scuff near the bottom edge.',
    locationFound: 'Engineering Hall Room 204',
    dateFound: '2026-11-15',
  },
  {
    imagePath: '/src/assets/images/sample_umbrella_scratch_1794977281134.jpg',
    filename: 'sample_umbrella_scratch.jpg',
    category: 'umbrella',
    description: 'Charcoal gray compact folding umbrella with a diagonal silver scratch on the black handle and white woven wrist strap.',
    locationFound: 'Science Building North Entrance',
    dateFound: '2026-11-15',
  },
  {
    imagePath: '/src/assets/images/sample_umbrella_clean_1794977281096.jpg',
    filename: 'sample_umbrella_clean.jpg',
    category: 'umbrella',
    description: 'Charcoal gray compact folding umbrella with smooth unmarked black handle and gray strap.',
    locationFound: 'Student Union Cafeteria',
    dateFound: '2026-11-16',
  },
  {
    imagePath: '/src/assets/images/sample_bag_pin_1794977282144.jpg',
    filename: 'sample_bag_pin.jpg',
    category: 'bag',
    description: 'Navy blue canvas commuter backpack with a round yellow smiley enamel pin on the front pocket.',
    locationFound: 'Campus Shuttle Stop B',
    dateFound: '2026-11-16',
  },
];

export async function loadSampleFoundItems(
  onProgress?: (current: number, total: number, label: string) => void,
): Promise<FoundItem[]> {
  const created: FoundItem[] = [];
  for (let i = 0; i < SAMPLE_ITEMS.length; i++) {
    const spec = SAMPLE_ITEMS[i];
    onProgress?.(i + 1, SAMPLE_ITEMS.length, `Indexing ${spec.category} sample (${i + 1}/${SAMPLE_ITEMS.length})...`);
    const res = await fetch(spec.imagePath);
    if (!res.ok) {
      throw new Error(`Failed to fetch sample image ${spec.filename}`);
    }
    const blob = await res.blob();
    const file = new File([blob], spec.filename, { type: 'image/jpeg' });
    const processed = await validateAndPreprocessImage(file);
    const saved = await indexFoundItemFromProcessed({
      processed,
      category: spec.category,
      description: spec.description,
      locationFound: spec.locationFound,
      dateFound: spec.dateFound,
    });
    created.push(saved);
  }
  return created;
}
