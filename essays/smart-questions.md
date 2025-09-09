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

# Clear Title and Context

The title immediately communicates the problem domain (AWS Certificate Manager, DNS validation) and the specific error (CAA error with Hostinger domain). A responder can anticipate the context without even clicking on the post.

# Demonstration of Prior Research and Effort

The question references the AWS documentation on DNS validation, the CAA settings, and their past attempts to solve the issue. This mirrors the advice of Raymond in showing what you have already tried, which shows responders that you are engaged and prevents them from telling you to do something you've already done.

# Concise and Relevant Technical Detail

The question asked provides the exact DNS records, error messages, and platform details. This satisfies the "show the problem, don't ask for a tutorial" principle. 

# Focused and Specific Problem Statement

The question is narror, seeking to understand why validation fails in Hostinger's CAA configuration. There are no other inquiries, and nothing vague like "it doesn't work".

# Polite and Considerate

The tone is professional, factual, and structured, reflecting the "smartness" expected in these community interactions.



```
Q: python date of the previous month

I am trying to get the date of the previous month with python. Here is what i've tried:

str( time.strftime('%Y') ) + str( int(time.strftime('%m'))-1 )

However, this way is bad for 2 reasons: First it returns 20122 for the February of 2012 (instead of 201202) 
and secondly it will return 0 instead of 12 on January.

I have solved this trouble in bash with:

echo $(date -d"3 month ago" "+%G%m%d")

I think that if bash has a built-in way for this purpose, then python, much more equipped, should provide something 
better than forcing writing one's own script to achieve this goal. Of course i could do something like:

if int(time.strftime('%m')) == 1:
    return '12'
else:
    if int(time.strftime('%m')) < 10:
        return '0'+str(time.strftime('%m')-1)
    else:
        return str(time.strftime('%m') -1)
        
I have not tested this code and i don't want to use it anyway (unless I can't find any other way:/)

Thanks for your help!
```

While the heading of his question could be better, it does convey what he’s trying to figure out. Usually something as brief as “python date of previous month” is what other users would enter in as search terms on Google, making it easily found. Another good thing about the question is that it’s not just a question. The asker shows what he or she has done and that he or she has put in some effort to answer the question. And while it may not be as important as the question itself, the asker shows courtesy, which does increase the chance of getting an answer.

```
A: datetime and the datetime.timedelta classes are your friend.

1. find today
2. use that to find the first day of this month.
3. use timedelta to backup a single day, to the last day of the previous month.
4. print the YYYYMM string you're looking for.

Like this:

 >>> import datetime
 >>> today = datetime.date.today()
 >>> first = datetime.date(day=1, month=today.month, year=today.year)
 >>> lastMonth = first - datetime.timedelta(days=1)
 >>> print lastMonth.strftime("%Y%m")
 201202
 >>>

```
 
The asker received six possible answers, and he or she was successful in inciting discussion from multiple users. The answers themselves were clear and were devoid of the rumored sarcasm and hostility of “hackers.” Since I myself have referenced this page and found it useful, I can confidently say that it is a good question.

## The foolproof way to get ignored.

While there are decent questions that benefit everyone, there are those one can ask to create an entirely different effect. In the following example, a user asks how he would, in short, create a desktop application with Facebook.

```
Q: Facebook Desktop Notifier

I am a beginner programmer that have never used anything other than what's included in a language.

I am trying to create a desktop application that notifies me anytime I get an update onfacebook. 
How should go about doing this? Thanks in advance.

edit Sorry I was not clear. Is there any way to make a DESKTOP application with facebook?
```

A simple “yes” would have answered the question, but we know that’s not the sort of answer he or she is looking for. Fortunately, someone kindly responded with a link to Facebook’s developer website. The asker should have done more research on his or her potential project. Then further down the road, he or she could have asked more specific and detailed questions that wouldn’t require a thousand-paged response for a sufficient answer.

## Conclusion

When we rely on others’ generosity and expertise to provide answers to our questions, it should hold that the question we ask should be one that leads to efficient and effective help that not only benefits us, but also the people we ask and others who might ask the same question in the future. Thus, if you have a question… make it a smart one! Asking questions may not always get you the best answer, but asking them in a way that will make others want to answer them will increase the success of finding a good solution and make it a positive experience on all sides.
