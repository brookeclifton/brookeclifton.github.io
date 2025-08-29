---
layout: project
type: project
image: img/scones.jpg
title: "Cook Brooke's Cook Book"
date: 2025
published: true
labels:
  - Cooking
  - CSS
  - HTML
  - Web Design
summary: "My digital recipe book for compiling my favorite and family recipies."
---

<img class="img-fluid" src="../img/cotton/cotton-header.png">

<div class="text-center p-4">
  <img width="200px" src="../img/cookies.jpg" class="img-thumbnail" >
  <img width="200px" src="../img/cinnamon.jpg" class="img-thumbnail" >
  <img width="200px" src="../img/micromouse/micromouse-circuit.png" class="img-thumbnail" >
</div>

"Cook Brooke's Cook Book" is a personal website I built on the platform Neocities, a website that lets you build your own sites from scratch using HTML, CSS, and JavaScript. 

I began building this as a solution to a problem I faced frequently in my personal life. Anyone who loves to cook knows the struggles of digital recipes. While the immense variety of any particular recipe on the internet is impressive, it becomes exhausting when trying to pick one to use. I find myself not able to decide on one of the hundreds of options, and once I pick, I can never find the same recipe again. Additionally, I, like many others, find it inexplicably frustrating when I have to scroll through the life story of the chef, on a page full of advertisments, before I can just see the ingredient list. All this coupled with the fact that almost all of my favorite family recipes are printed on tiny index cards, dirty from years of use, I knew it was time to figure out my own solution.

As the creator of this project, I was responsible for every aspect of the website, from designing, to to writing the code, and organizing the content in a visually appealing way. I implemented responsive design to ensure the cookbook could be viewed on any kind of device. I also experimented with interactive deatures such as links, 'back' buttons, and more. I plan on continuing to add to the website, not just new recipes, but more complex features as well. I am currently working on a function that allows users to adjust ingredient quantities based on the desired number of servings by automatically scaling the ingredient list.

This was my first time working in both HTML and CSS, but after doing a few courses on [freeCodeCamp]([https://manoa.hawaii.edu/news/article.php?aId=2857](https://www.freecodecamp.org/learn/2022/responsive-web-design/)), I was able to work through it. I learned all the basics of formatting in CSS, but more importantly I learned hands-on about the difficulties of project planning, website structuring, creating simple user experiences, and the technial execution of design visions.

Take a look at my cookbook: [Cook Brooke's Cook Book](https://brooke-hana.neocities.org/)

Here is an example of one of my HTML files
```cpp
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Baguette</title>
    <link href="/style.css" rel="stylesheet" type="text/css" media="all">
    <link rel="icon" type="image/x-icon" href="/icon.jpeg">
  </head>
  <div class="text-container">
  <body>
    <h1>Baguette:</h1>
    <h2>ingredients:</h2>
    <ul>
      <li>1 1/2 cup (225g) <i>flour</i></li>
      <li>1 tsp <i>salt</i></li>
      <li>1 tsp <i>instant yeast</i></li>
      <li>3/4 cup <i>warm water</i></li>
    </ul>
    <h2>directions:</h2>
    <p>mix until well combined. cover and let rise for <i>90 minutes</i>. fold all the corners in, then separate into two and form into baguettes by holding both ends and shaking.</p>
    <p>grab bottom edge and wrap over the top of the baguette to create smooth surface. dust with flour. cover with towel and let rise for <i>30 minutes</i>.</p>
    <p>preheat oven to <i>445º F</i> with a tray of water inside. make three slashes, then bake for <i>30 minutes</i>.</p>
    <button onclick="history.back()">back</button>
  </body>
  <div class="text-container">
</html>
```


