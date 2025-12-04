---
layout: essay
type: essay
title: "The Hidden Structure of Software"
date: 2025-12-03
published: true
labels:
  - Design Patterns
  - Prisma
  - React
---

<img width="200px" class="rounded float-start pe-4" src="/img/patterns.png">

## What to Know About Design Patterns

In software engineering, developers often face problems that are not unique, but are recurring challenges across many systems. Cross-component communication, object creation, and interface structures are some examples of these universal problems. Over decades of experience, engineers identified solutions to such problems which would provide effective and elegant results. These are <strong>design patterns</strong>, general templates for solving common problems. They allow software engineers to create systems that are easier to build and evolve.

### Fundamental Patterns

<strong>Factory Pattern:</strong> Addresses a core issue with object-oriented programming. Factories hold the logic for creation of objects, allowing the system to request objects without knowing exactly how they're constructed. This is piviotal for systems that will eventually be scaling up.

<strong>Singleton Pattern:</strong> How do you ensure there is only one instance of a class over the whole application? Singletons are good for shared resources, where multiple copies would create inconsistency.

<strong>Observer Pattern:</strong> A clean way for different parts of the system to interact without being bound together. An object can automatically 'notify' the observers when it's state changes. This allows for dynamic, reactive behavior which is good for user interfaces, real time updates, and systems where many things must be synchronized. 

<strong>Model-View-Controller:</strong> Organizes application structure by dividing responsibilities into 3 parts. The <i>Model</i> manages data and logic, the <i>View</i> presents information to users, and the <i>Controller</i> handles input and coordinates between the other two. This makes large systems more understandable, and is common in most web applications.

## Implementation in RoomMatch UHM

In our RoomMatch final project, we adopted several classic design patterns. At a high level, the app follows a Model-View-Controller structure. We use Prisma models as the Model layer, Next.js route handlers act as the Controllers for data fetching, and React components make up the View layer for the user interface. 
Our Prisma client is implemented as a Singleton so the entire app shares one databse connection. 
Because the user interface is built with React, it naturally fits with the Observer pattern. Components automatically re-render when underlying states change. 
Our reusable React components and database helper functions act as simple, factory-like functions, constructing UI layouts and profiles from data. 



