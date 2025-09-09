---
layout: essay
type: essay
title: "Smart Questions for Smart Software Engineers"
# All dates must be YYYY-MM-DD format!
date: 2025-09-08
published: true
labels:
  - Questions
  - Answers
  - StackOverflow
---

<img width="300px" class="rounded float-start pe-4" src="../img/smart-questions/rtfm.png">

## Introduction

Software engineering is not only about writing code, it is also about problem solving in times of uncertainty. The ability to ask good questions is an essential skill, particularly in the current days of the internet. There are so many questions floating around the internet. If someone who is able to help doesn't have all the information they need, they will brush right past your question to find one that's easier to answer. Eric S. Raymond's "How to Ask Questions the Smart Way" provides a blueprint for asking technical questions that encourage useful answers, without increasing the cognitive load on responders. By analyzing Stack Overflow questions, we will examine the contrasts between a good and bad question.

## A smart question on Stack Overflow

The Stack Overflow question we will focus on is about an [AWS certificate manager: http://www.catb.org/esr/faqs/smart-questions.html]. This question exhibits several characteristics of a smart question.

### Clear Title and Context

The title immediately communicates the problem domain (AWS Certificate Manager, DNS validation) and the specific error (CAA error with Hostinger domain). A responder can anticipate the context without even clicking on the post.

### Demonstration of Prior Research and Effort

The question references the AWS documentation on DNS validation, the CAA settings, and their past attempts to solve the issue. This mirrors the advice of Raymond in showing what you have already tried, which shows responders that you are engaged and prevents them from telling you to do something you've already done.

### Concise and Relevant Technical Detail

The question asked provides the exact DNS records, error messages, and platform details. This satisfies the "show the problem, don't ask for a tutorial" principle. 

### Focused and Specific Problem Statement

The question is narror, seeking to understand why validation fails in Hostinger's CAA configuration. There are no other inquiries, and nothing vague like "it doesn't work".

### Polite and Considerate

The tone is professional, factual, and structured, reflecting the "smartness" expected in these community interactions.

As a result of this, responses can be focused and high-quality, relfecting the reciprocal smartness that smart questions require from the community.

## A Poorly Formulated Question

A question that does not follow the smart question guidelines might look like this:

