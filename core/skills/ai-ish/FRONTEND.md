# Frontend checklist

## Over-explaining

Text the user does not need. The assistant's voice leaks into the product.

- Explanation of behaviour the screen already shows: a placeholder that describes what its label names, a modal paragraph on what its button does.
- Restating what is already on screen: a description that rewords its heading, a toast that repeats what the confirm dialog said.
- Mechanism lists: how or when the system does something, when the screen already shows it (for example, a badge on each item).
- Implementation terms where the user's own word exists: "points to", "cache", "sync job", "record".
- Reassurance padding that changes nothing when removed: "for now", "first", "safely", "don't worry".
- Examples inserted into help text: "such as …", "for example …".
- Keyboard shortcut announcements in labels, tooltips, banners, or empty states.
- Celebration: "Done!", "Welcome back!", exclamation marks, emoji in labels and messages, a success toast after a change the user already sees.
- Tooltips on controls whose label or icon already says what they do.
- Generic copy that fits any product: "Unlock …", "Seamless", "Get started", "Learn more".

Keep warnings about data loss or irreversible actions, and error messages that name the problem and the recovery.

Fix: cut each string to what the user needs to act. A long explanation becomes one sentence or nothing. Each shortened string stays clear on one read without the removed part.

## Surface without substance

Things that make the screen look complete without serving the user.

- Fabricated data: invented metrics ("10x faster", "+12.5%"), placeholder names (Jane Doe, Acme), sample numbers presented as real.
- Indicators bound to nothing: status dots, badges, progress rings, or sparklines that read no real state.
- Dead controls: buttons without handlers, `href="#"`, menu items and settings that change nothing.
- A dashboard that shows every available number at equal weight, with no element answering the user's main question.
- Every feature visible at once instead of where it is used. More than one primary action in a view.
- Missing states: a list or data view with no empty, loading, or error state.
- Interruptions for routine actions: a confirm modal for a reversible action, a toast for every action.

Fix: replace fabricated data with real data or a labelled placeholder, never with another invented value. Add missing states. Wiring or removing an indicator, a dead control, or a modal is an ask-first item.

## Drift

Values chosen per component instead of from one system.

Inventory first. Collect every distinct value of border-radius, color (utility classes and raw values), shadow, font family, font size, and spacing (padding, margin, gap) in the target, with a count for each.

- Values outside the project's tokens or scale, and values used only once.
- Radius that differs between elements of the same role, or one radius on every element regardless of size (buttons, inputs, pills, avatars, and cards alike).
- More than one gray family (slate, gray, zinc mixed), more than one accent color, or saturation that differs between components.
- Siblings of the same kind with different padding or gaps.
- Mixed icon sets or stroke widths, and emoji standing in for icons.
- A section that does not share the page's type, palette, shape, or density.

Fix: map each stray value onto the existing tokens or scale. When the project has none, use the most frequent value for each role and record that choice in the report.

## Template defaults

The average of the training data, used without a reason specific to this product. Every item here is a taste call.

- Inter or the system font as the only typeface.
- Purple, indigo, or violet gradients, gradient text, colored glows and shadows.
- Three identical icon-topped cards as page structure, cards nested in cards, an icon in a rounded colored square.
- A colored stripe on one edge of a card.
- An eyebrow label above every heading, numbered 01/02/03 sections, everything centered.
- Glass and blur as decoration, decorative blobs, orbs, and wavy dividers.
- The same hover scale, bounce, or fade-in on every element.

## Post-fix check

After fixing, view each changed screen in a browser and read each shortened string in place. When the screens cannot be rendered, record this check under Not checked.
