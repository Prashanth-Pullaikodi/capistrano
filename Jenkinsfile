#!/usr/bin/env groovy
import hudson.model.*
sh 'source ~/.bashrc '
node {
  stage 'Commit'
  checkout scm
    sh 'bundle exec cap vagrantbox build'
}
