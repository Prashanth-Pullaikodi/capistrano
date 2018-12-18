#!/usr/bin/env groovy
import hudson.model.*
sh 'source ~/.bashrc '
node('master') {
  stage 'Commit'
  checkout scm
    sh 'bundle exec cap vagrantbox build'
}
