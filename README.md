<div align="center">

# Detecting Foreign Material - Phase 3

The project is a visual recognition system in order to detct foreign material on a conveyor belt. Other features include:
  -Carrot dimension calculation
  -# of carrots passed per day/month/year, weight of carrots over unit time

</div>


## Overview

The software will be implemented using two cameras about 4 feet above the conveyor belt. It uses a yolov26 model for both object detection and dimension calculation. Any foreign material will trigger a solenoid for another mechanism to remove said material. SQLite will be used to capture event data, along with a file path for the corresponding image. 



### Goals

-Detect foreign materials from conveyor belt on a harvester
-Classify foreign materials from conveyor belt
-Determine dimensions of carrots that pass (height, width, etc)
-Analyze and create statistics of carrots (# that pass per unit time, average weight, etc)

### Features

- [x] Feature 1
- [x] Feature 2
- [ ] Feature 3

### Software Stack / Technologies Used

- Language: Python, JavaScript
- Framework: React
- Database: sqlite3
- etc...

## Quickstart

Summary for developers with links to setup, build, test instructions in wiki or docs.

### Instructions

1. Click "Use this template" on GitHub to create your private repository.
2. Clone your repo locally.
3. Fill in the metadata table above.
4. Create an initial branch (e.g., `setup`), never commit directly to `main` (unless instructed).
5. Open an Issue for each lab / feature before starting work.
6. Use Pull Requests to merge changes (each PR should reference at least one Issue).

## Structure

Include: what constitutes passing (e.g., all tests green, coverage threshold).

## Coding & Collaboration Conventions

- Use semantic commit messages (see `CONTRIBUTING.md` for full details).
- Open an Issue for every distinct unit of work (lab task, feature, bug, refactor, research).
- Create branches from `main` named after the Issue: `<type>/short-kebab` (e.g., `feat/scheduler-phase1`).
- Commit changes incrementally with semantic commit messages.
- Open a Pull Request early (draft) and link the Issue.
- Request peer review (if required) before merging.
- Squash merge or rebase to keep `main` linear (unless told otherwise).
