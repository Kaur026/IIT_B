import React from 'react';

export type CategoryType =
  | 'pregnant'
  | 'lactating'
  | 'children0to6m'
  | 'children6mTo3y'
  | 'children3to6y'
  | 'adolescent';

interface CategoryIllustrationProps {
  type: CategoryType;
  className?: string;
  size?: number;
}

export const CATEGORY_IMAGE_PATHS: Record<CategoryType, string> = {
  pregnant: '/assets/categories/pregnant-women.svg',
  lactating: '/assets/categories/lactating-mothers.svg',
  children0to6m: '/assets/categories/children-0-6m.svg',
  children6mTo3y: '/assets/categories/children-6m-3y.svg',
  children3to6y: '/assets/categories/children-3-6y.svg',
  adolescent: '/assets/categories/adolescent-girls.svg',
};

export const CATEGORY_ALT_TEXTS: Record<CategoryType, string> = {
  pregnant: 'Illustration of pregnant woman with supportive maternal care',
  lactating: 'Illustration of lactating mother cradling and nursing newborn infant',
  children0to6m: 'Illustration of infant 0-6 months swaddled in cradle',
  children6mTo3y: 'Illustration of toddler 6 months to 3 years taking weaning food',
  children3to6y: 'Illustration of preschool child 3-6 years with early learning slate',
  adolescent: 'Illustration of adolescent girl with school books and nutrition health',
};

export const CategoryIllustration: React.FC<CategoryIllustrationProps> = ({
  type,
  className = 'w-11 h-11',
  size,
}) => {
  const src = CATEGORY_IMAGE_PATHS[type] || CATEGORY_IMAGE_PATHS.children0to6m;
  const alt = CATEGORY_ALT_TEXTS[type] || 'Beneficiary category illustration';

  return (
    <div
      className={`relative shrink-0 rounded-2xl overflow-hidden shadow-xs border border-white/60 flex items-center justify-center transition-transform hover:scale-105 duration-200 ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-contain pointer-events-none select-none"
        loading="eager"
        decoding="async"
        onError={(e) => {
          // If image load fails for any reason, ensure graceful display
          const target = e.currentTarget;
          target.style.display = 'none';
        }}
      />
    </div>
  );
};
