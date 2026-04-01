import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/lib/utils';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

/**
 * Body copy using the same typography tokens as shadcn `CardDescription` / `FormDescription`
 * (`text-sm text-muted-foreground`). Use `asChild` to render a `span` (e.g. inside list items).
 */
const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'p';
    return (
      <Comp
        ref={ref as never}
        className={cn('text-sm leading-relaxed text-muted-foreground', className)}
        {...props}
      />
    );
  },
);
Text.displayName = 'Text';

export { Text };
