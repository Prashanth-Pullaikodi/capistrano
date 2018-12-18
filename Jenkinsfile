sh "source ~/.bashrc"
node {
    stage "Create build output"
    
    sh "source ~/.bashrc"
    dir('capistrano') {
        sh  "bundle exec cap vagrantbox build"
    }
   
}
