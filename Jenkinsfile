sh 'source ~/.bashrc '
node {
  stage 'Commit'
  checkout scm
  dir('capistrano') {
    sh 'bundle exec cap vagrantbox build'
}

}
