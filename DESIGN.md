# 字落成滴 Design Notes

## Concept

`字落成滴` is a minimal interactive typography sketch. Chinese characters form a teardrop silhouette, then behave like a soft hanging mesh: hover pushes the form, click repels it, and drag pulls individual characters.

The project should feel closer to a compact generative-art study than a website.

## Visual Direction

- Centered square canvas on a quiet warm-gray page.
- Rice-paper canvas background.
- Black Chinese serif characters as the main material.
- Lake green-blue liquid line and melt color.
- No panels, cards, images, gradients, or decorative UI.
- Text itself forms the droplet shape; there is no filled droplet image behind it.

## Interaction

- Hover: gently pushes nearby characters.
- Click: creates a stronger ripple/repel force.
- Drag: grabs the nearest character point.
- `reset`: canvas text at bottom-left; rebuilds the droplet.
- `R`: reset.
- `Space`: burst force through the mesh.

## Shape System

The droplet is generated from rows of character points:

- top rows are narrow to create a pointed tip;
- middle rows widen into the droplet body;
- lower rows taper into a rounded bottom;
- points are clamped back inside the droplet boundary after physics updates.

Links between nearby points create the cloth-like movement.

## Files

- `index.html`: minimal page shell and p5 loading.
- `styles.css`: centered canvas layout and simple visual treatment.
- `app.js`: p5 sketch, droplet point layout, mesh physics, interaction, reset.
- `scripts/validate-static.py`: lightweight static validation.
