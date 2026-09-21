<template>
  <div class="app">
    <header class="top">
      <div class="brand">pdfstore</div>
      <nav>
        <RouterLink to="/">Library</RouterLink>
        <RouterLink to="/upload">Upload</RouterLink>
        <RouterLink to="/exports">Exports</RouterLink>
        <RouterLink to="/categories">Categories</RouterLink>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>
