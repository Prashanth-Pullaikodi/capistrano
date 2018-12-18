pipeline {
    agent any
    checkout scm 
    stages {
        stage ('Build Image') {

            dir('config') {
                      sh 'bundle exec cap vagrantbox docker:build_image'
                      } 
                }
     
        }
}
