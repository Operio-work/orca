export const prerender = true;
// Pages are written as <path>.html (catalog.html, es/catalog.html), so nginx serves them
// with try_files and never has to redirect a directory.
export const trailingSlash = 'never';
