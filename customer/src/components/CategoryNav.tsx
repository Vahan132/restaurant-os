'use client';

interface Category {
  id: string;
  name: string;
}

interface Props {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function CategoryNav({ categories, activeId, onSelect }: Props) {
  if (categories.length === 0) return null;

  return (
    <nav
      aria-label="Menu categories"
      className="sticky top-[57px] z-20 border-b border-gray-100 bg-white/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((c) => {
          const isActive = c.id === activeId;
          return (
            <li key={c.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={isActive ? 'true' : undefined}
                className={
                  'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ' +
                  (isActive
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                }
              >
                {c.name}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
