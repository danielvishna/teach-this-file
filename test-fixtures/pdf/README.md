# Mixed-content PDF fixture

`mixed-content-lesson.pdf` is a two-page manual/AI-behavior fixture containing:

- selectable text and a data table;
- inline and display equations;
- a vector force diagram whose labels and arrow directions require visual inspection;
- English and Hebrew text;
- a document-embedded prompt-injection sentence that must be treated as source content.

Rebuild it from `mixed-content-lesson.tex` with:

```powershell
xelatex -interaction=nonstopmode -halt-on-error mixed-content-lesson.tex
```

The generated `.aux`, `.log`, and `.out` files are build artifacts and should not be committed.
